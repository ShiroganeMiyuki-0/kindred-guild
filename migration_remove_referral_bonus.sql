-- =========================================================================
-- KINDRED GUILD — FIX: Remove referral bonus coins (tracking only)
-- Date: 2026-07-10
-- =========================================================================

-- Update apply_referral_code to NOT give bonus coins (just track the referral)
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT, p_referred_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
BEGIN
  -- Validate code
  SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = UPPER(p_code) AND uses_count < max_uses;
  IF v_referrer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired referral code.'; END IF;
  IF v_referrer_id = p_referred_id THEN RAISE EXCEPTION 'You cannot refer yourself.'; END IF;
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_referred_id) INTO v_already_referred;
  IF v_already_referred THEN RAISE EXCEPTION 'You have already used a referral code.'; END IF;

  -- Track the referral (no bonus coins)
  INSERT INTO referrals (referrer_id, referred_id, referral_code, bonus_paid)
  VALUES (v_referrer_id, p_referred_id, UPPER(p_code), FALSE);

  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE code = UPPER(p_code);

  -- Notify referrer (no coin mention)
  PERFORM create_notification(v_referrer_id, 'referral_used',
    'New Referral! 🎉', 'Someone signed up using your referral code!',
    'referral.html');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_referral_stats to not show bonus earned
DROP FUNCTION IF EXISTS get_referral_stats();
CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS TABLE(
  code TEXT,
  total_referrals BIGINT,
  referrals_left INTEGER
) AS $$
  SELECT
    rc.code,
    rc.uses_count,
    (rc.max_uses - rc.uses_count)
  FROM referral_codes rc
  WHERE rc.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
