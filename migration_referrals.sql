-- =========================================================================
-- KINDRED GUILD — MIGRATION: Referral System
-- Date: 2026-07-10
-- =========================================================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  uses_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_referral UNIQUE (user_id)
);

-- Referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  bonus_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_referred UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code" ON referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own referral code" ON referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view referral codes by code" ON referral_codes FOR SELECT USING (true);
CREATE POLICY "Users can view referrals they made" ON referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "System can insert referrals" ON referrals FOR INSERT WITH CHECK (true);

-- Generate or get referral code for current user
CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_existing TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  -- Check if user already has a code
  SELECT code INTO v_existing FROM referral_codes WHERE user_id = v_user_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Generate a new code (8 chars, alphanumeric)
  v_code := UPPER(SUBSTRING(MD5(v_user_id::TEXT || NOW()::TEXT) FROM 1 FOR 8));

  INSERT INTO referral_codes (user_id, code) VALUES (v_user_id, v_code);
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply referral code when signing up (called after user creation)
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT, p_referred_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_bonus INTEGER := 25; -- 25 FC bonus for both parties
BEGIN
  -- Validate code
  SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = UPPER(p_code) AND uses_count < max_uses;
  IF v_referrer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired referral code.'; END IF;

  -- Can't refer yourself
  IF v_referrer_id = p_referred_id THEN RAISE EXCEPTION 'You cannot refer yourself.'; END IF;

  -- Check if already referred
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_referred_id) INTO v_already_referred;
  IF v_already_referred THEN RAISE EXCEPTION 'You have already used a referral code.'; END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_id, referral_code, bonus_paid)
  VALUES (v_referrer_id, p_referred_id, UPPER(p_code), TRUE);

  -- Update uses count
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE code = UPPER(p_code);

  -- Bonus coins to both parties
  INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
  VALUES (v_referrer_id, v_bonus, 'referral_bonus', NOW());
  INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
  VALUES (p_referred_id, v_bonus, 'referral_bonus', NOW());

  -- Notify referrer
  PERFORM create_notification(v_referrer_id, 'referral_used',
    'Referral Used! 🎉', 'Someone used your referral code. +' || v_bonus || ' FC bonus!',
    'profile.html');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get referral stats for current user
CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS TABLE(
  code TEXT,
  total_referrals BIGINT,
  total_bonus_earned INTEGER,
  referrals_left INTEGER
) AS $$
  SELECT
    rc.code,
    rc.uses_count,
    (rc.uses_count * 25)::INTEGER,
    (rc.max_uses - rc.uses_count)
  FROM referral_codes rc
  WHERE rc.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
