-- =========================================================================
-- KINDRED GUILD — PayPal Support Migration
-- Adds PayPal as a second payment method on coin_purchases alongside UPI.
-- UPI flow remains untouched for existing rows.
-- =========================================================================

-- 1. Add payment method discriminator (defaults to 'upi' so every historical
--    and new UPI row is classified correctly without backfill).
ALTER TABLE coin_purchases
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'upi';

-- 2. Add PayPal-specific fields (all nullable; only used when payment_method='paypal')
ALTER TABLE coin_purchases
  ADD COLUMN IF NOT EXISTS paypal_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_payer_email TEXT,
  ADD COLUMN IF NOT EXISTS foreign_currency  TEXT,
  ADD COLUMN IF NOT EXISTS foreign_amount    NUMERIC(10,2);

-- 3. Relax upi_transaction_ref so PayPal rows (no UTR) can land in the table
--    and so users can still log a purchase without a UTR (matches client-side
--    behavior of utr || null in the JS).
ALTER TABLE coin_purchases
  ALTER COLUMN upi_transaction_ref DROP NOT NULL;

-- 4. Replace the blanket UNIQUE on upi_transaction_ref with partial unique
--    indexes so we can have unique constraints per payment-method namespace.
ALTER TABLE coin_purchases
  DROP CONSTRAINT IF EXISTS coin_purchases_upi_transaction_ref_key;

CREATE UNIQUE INDEX IF NOT EXISTS coin_purchases_upi_ref_unique
  ON coin_purchases (upi_transaction_ref)
  WHERE upi_transaction_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coin_purchases_paypal_order_unique
  ON coin_purchases (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coin_purchases_paypal_capture_unique
  ON coin_purchases (paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;

-- 5. Whitelist allowed payment methods
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_method'
  ) THEN
    ALTER TABLE coin_purchases
      ADD CONSTRAINT chk_payment_method
      CHECK (payment_method IN ('upi', 'paypal'));
  END IF;
END
$$;

-- 6. Helpful index for admin filtering
CREATE INDEX IF NOT EXISTS idx_coin_purchases_payment_method
  ON coin_purchases (payment_method, status);

-- 7. Update approve_coin_purchase so the ledger `reason` reflects the
--    actual payment method (paypal_purchase for PayPal, upi_purchase
--    for UPI). Recreates the function in place.
CREATE OR REPLACE FUNCTION public.approve_coin_purchase(p_purchase_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_admin_id UUID;
  v_purchase RECORD;
  v_reason   TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can approve purchases.';
  END IF;

  SELECT * INTO v_purchase FROM coin_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found.';
  END IF;

  IF v_purchase.status = 'verified' THEN
    RAISE EXCEPTION 'Purchase already verified.';
  END IF;

  UPDATE coin_purchases SET status = 'verified' WHERE id = p_purchase_id;

  v_reason := CASE v_purchase.payment_method
    WHEN 'paypal' THEN 'paypal_purchase'
    ELSE 'upi_purchase'
  END;

  INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
  VALUES (v_purchase.user_id, v_purchase.coin_amount, v_reason, NOW());

  RETURN TRUE;
END;
$function$;

-- =========================================================================
-- DONE. Apply via:
--   Supabase Dashboard -> SQL Editor -> paste + run
-- =========================================================================
