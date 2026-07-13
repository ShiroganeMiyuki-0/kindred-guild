-- =========================================================================
-- KINDRED GUILD — MIGRATION: Admin Grant Wish
-- Date: 2026-07-13
-- Allows admins to grant a wish, crediting pooled backings to the creator
-- =========================================================================

CREATE OR REPLACE FUNCTION admin_grant_wish(p_wish_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_wish RECORD;
  v_coin_backings NUMERIC;
  v_upi_backings NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can grant wishes.';
  END IF;

  -- Lock and fetch the wish
  SELECT * INTO v_wish FROM wishes WHERE id = p_wish_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found.';
  END IF;

  IF v_wish.is_deleted = TRUE THEN
    RAISE EXCEPTION 'Cannot grant a deleted wish.';
  END IF;

  IF v_wish.status = 'granted' THEN
    RAISE EXCEPTION 'This wish has already been granted.';
  END IF;

  IF v_wish.status != 'active' THEN
    RAISE EXCEPTION 'Only active wishes can be granted.';
  END IF;

  -- Credit pooled coin backings to the wish creator
  SELECT COALESCE(SUM(coin_amount), 0) INTO v_coin_backings
  FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'coins';

  SELECT COALESCE(SUM(upi_amount), 0) INTO v_upi_backings
  FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'upi';

  IF v_coin_backings > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_wish.creator_id, v_coin_backings, 'wish_granted_payout', NOW());
  END IF;

  -- Mark wish as granted
  UPDATE wishes SET status = 'granted' WHERE id = p_wish_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;