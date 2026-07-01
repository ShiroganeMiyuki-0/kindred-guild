-- =========================================================================
-- KINDRED GUILD — COMPLETE BACKEND SQL SCHEMA
-- Paste this directly into the Supabase SQL Editor and run it.
-- =========================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist to allow clean setups
DROP TRIGGER IF EXISTS tr_recalculate_rep ON ratings;
DROP FUNCTION IF EXISTS recalculate_reputation(UUID);
DROP FUNCTION IF EXISTS submit_rating(UUID, INTEGER);
DROP FUNCTION IF EXISTS approve_quest(UUID);
DROP FUNCTION IF EXISTS post_quest_with_commission(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_coin_balance(UUID);

DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS quest_comments CASCADE;
DROP TABLE IF EXISTS coin_purchases CASCADE;
DROP TABLE IF EXISTS fairy_ledger CASCADE;
DROP TABLE IF EXISTS quests CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 1. USER PROFILES
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  reputation_score INTEGER DEFAULT 0, -- Scaled by 10 (e.g., 45 represents a 4.5 star average)
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_reputation CHECK (reputation_score >= 0 AND reputation_score <= 50)
);

-- 2. QUESTS
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL,
  worker_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  coin_amount INTEGER,
  upi_amount INTEGER,
  commission_coins INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  proof_url TEXT,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  appraisal_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT quests_poster_id_fkey FOREIGN KEY (poster_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT quests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_payment_type CHECK (payment_type IN ('coins', 'upi', 'free')),
  CONSTRAINT chk_status CHECK (status IN ('open', 'accepted', 'submitted', 'approved', 'disputed', 'cancelled')),
  CONSTRAINT chk_positive_reward CHECK (
    (payment_type = 'coins' AND coin_amount > 0 AND upi_amount IS NULL) OR
    (payment_type = 'upi' AND upi_amount > 0 AND coin_amount IS NULL) OR
    (payment_type = 'free' AND coin_amount IS NULL AND upi_amount IS NULL)
  )
);

-- Create index on status for high performance lookups
CREATE INDEX idx_quests_status ON quests(status);

-- 3. FAIRY LEDGER (Coin flow database)
CREATE TABLE fairy_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  reason TEXT NOT NULL, -- e.g. 'quest_commission', 'upi_purchase', 'quest_earning', 'refund', 'commission_locked', 'reward_locked'
  quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. QUEST COMMENTS
CREATE TABLE quest_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RATINGS
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revealed BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT chk_score CHECK (score >= 1 AND score <= 5),
  CONSTRAINT unique_quest_rater UNIQUE (quest_id, rater_id)
);

-- 6. COIN PURCHASES (Manual payment on-ramp)
CREATE TABLE coin_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  coin_amount INTEGER NOT NULL,
  upi_transaction_ref TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT chk_purchase_status CHECK (status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT chk_positive_coins CHECK (coin_amount > 0)
);


-- =========================================================================
-- DATABASE FUNCTIONS & PROCEDURAL LOGIC (SECURITY DEFINER)
-- =========================================================================

-- Function to compute active coin balance of a user
CREATE OR REPLACE FUNCTION get_coin_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM fairy_ledger
  WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- Transactional posting of a quest (deducts commission/rewards upfront)
CREATE OR REPLACE FUNCTION post_quest_with_commission(
  p_title TEXT,
  p_description TEXT,
  p_payment_type TEXT,
  p_coin_amount INTEGER,
  p_upi_amount INTEGER,
  p_commission_coins INTEGER,
  p_deadline TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER;
  v_quest_id UUID;
  v_required_coins INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to post a quest.';
  END IF;

  -- Verify user is not suspended
  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_user_id AND is_suspended = TRUE) THEN
    RAISE EXCEPTION 'Your account is suspended. You cannot post quests.';
  END IF;

  v_balance := get_coin_balance(v_user_id);

  -- Validate balances and compute requirements
  IF p_payment_type = 'coins' THEN
    v_required_coins := p_coin_amount + p_commission_coins;
    IF v_balance < v_required_coins THEN
      RAISE EXCEPTION 'Not enough Fairy Coins. You need % FC (Reward + % FC commission) but only have % FC.', 
        v_required_coins, p_commission_coins, v_balance;
    END IF;
  ELSIF p_payment_type = 'upi' THEN
    v_required_coins := p_commission_coins;
    IF v_balance < v_required_coins THEN
      RAISE EXCEPTION 'Not enough Fairy Coins. You need % FC for commission (10%% of Rupee value) but only have % FC.', 
        v_required_coins, v_balance;
    END IF;
  ELSE
    v_required_coins := 0;
  END IF;

  -- Create Quest
  INSERT INTO quests (
    poster_id, title, description, payment_type, coin_amount, upi_amount, commission_coins, status, deadline, created_at
  ) VALUES (
    v_user_id, p_title, p_description, p_payment_type, 
    CASE WHEN p_payment_type = 'coins' THEN p_coin_amount ELSE NULL END,
    CASE WHEN p_payment_type = 'upi' THEN p_upi_amount ELSE NULL END,
    CASE WHEN p_payment_type IN ('coins', 'upi') THEN p_commission_coins ELSE NULL END,
    'open', p_deadline, NOW()
  ) RETURNING id INTO v_quest_id;

  -- Deduct balances upfront (Lock Funds)
  IF p_payment_type = 'coins' THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -p_commission_coins, 'commission_locked', v_quest_id, NOW());
    
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -p_coin_amount, 'reward_locked', v_quest_id, NOW());
  ELSIF p_payment_type = 'upi' THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -p_commission_coins, 'commission_locked', v_quest_id, NOW());
  END IF;

  RETURN v_quest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Transactional Approval function to release reward and complete commissions
CREATE OR REPLACE FUNCTION approve_quest(p_quest_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found.';
  END IF;

  IF v_quest.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the poster can approve this quest.';
  END IF;

  IF v_quest.status != 'submitted' THEN
    RAISE EXCEPTION 'Only submitted quests can be approved.';
  END IF;

  -- Update quest status
  UPDATE quests 
  SET status = 'approved', appraisal_deadline = NULL
  WHERE id = p_quest_id;

  -- Release locked coins to the worker if applicable
  IF v_quest.payment_type = 'coins' THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_quest.worker_id, v_quest.coin_amount, 'quest_earning', p_quest_id, NOW());
  END IF;

  -- Double-blind rating window is now implicitly open.
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recalculate reputation score based on revealed ratings
CREATE OR REPLACE FUNCTION recalculate_reputation(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg_score NUMERIC;
  v_int_score INTEGER;
BEGIN
  SELECT AVG(score) INTO v_avg_score
  FROM ratings
  WHERE ratee_id = p_user_id AND revealed = TRUE;

  IF v_avg_score IS NULL THEN
    v_int_score := 0;
  ELSE
    v_int_score := ROUND(v_avg_score * 10)::INTEGER; -- store as integer (0-50)
  END IF;

  UPDATE user_profiles
  SET reputation_score = v_int_score
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Handle rating submission with double-blind revealing
CREATE OR REPLACE FUNCTION submit_rating(
  p_quest_id UUID,
  p_score INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
  v_ratee_id UUID;
  v_other_rating_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Score must be between 1 and 5.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found.';
  END IF;

  IF v_quest.status != 'approved' THEN
    RAISE EXCEPTION 'You can only rate approved quests.';
  END IF;

  IF v_quest.payment_type = 'free' THEN
    RAISE EXCEPTION 'Free quests do not support ratings.';
  END IF;

  -- Determine ratee
  IF v_quest.poster_id = v_user_id THEN
    v_ratee_id := v_quest.worker_id;
  ELSIF v_quest.worker_id = v_user_id THEN
    v_ratee_id := v_quest.poster_id;
  ELSE
    RAISE EXCEPTION 'You are not a participant in this quest.';
  END IF;

  -- Guard duplication
  IF EXISTS (SELECT 1 FROM ratings WHERE quest_id = p_quest_id AND rater_id = v_user_id) THEN
    RAISE EXCEPTION 'You have already rated this participant.';
  END IF;

  -- Insert rating (hidden initial state)
  INSERT INTO ratings (quest_id, rater_id, ratee_id, score, submitted_at, revealed)
  VALUES (p_quest_id, v_user_id, v_ratee_id, p_score, NOW(), FALSE);

  -- Check other participant submission
  SELECT EXISTS (
    SELECT 1 FROM ratings 
    WHERE quest_id = p_quest_id AND rater_id = v_ratee_id
  ) INTO v_other_rating_exists;

  -- Unblind instantly if both have completed their reviews
  IF v_other_rating_exists THEN
    UPDATE ratings SET revealed = TRUE WHERE quest_id = p_quest_id;
    
    -- Recalculate reputations for both parties
    PERFORM recalculate_reputation(v_quest.poster_id);
    PERFORM recalculate_reputation(v_quest.worker_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- SCHEDULED TASK FUNCTIONS (for pg_cron)
-- =========================================================================

-- Auto-approve quests after 48 hours if poster hasn't acted
CREATE OR REPLACE FUNCTION auto_approve_quests()
RETURNS VOID AS $$
DECLARE
  v_quest RECORD;
BEGIN
  FOR v_quest IN
    SELECT q.id, q.poster_id, q.worker_id, q.coin_amount, q.payment_type
    FROM quests q
    WHERE q.status = 'submitted'
      AND q.appraisal_deadline < NOW()
      AND q.appraisal_deadline IS NOT NULL
  LOOP
    -- Update quest status
    UPDATE quests 
    SET status = 'approved', appraisal_deadline = NULL
    WHERE id = v_quest.id;

    -- Release locked coins to the worker if applicable
    IF v_quest.payment_type = 'coins' THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.worker_id, v_quest.coin_amount, 'quest_earning', v_quest.id, NOW());
    END IF;

    -- Log the auto-approval event
    RAISE NOTICE 'Auto-approved quest %', v_quest.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-reveal ratings after 7 days and update reputation
CREATE OR REPLACE FUNCTION reveal_ratings_and_update_reputation()
RETURNS VOID AS $$
DECLARE
  v_rating RECORD;
  v_affected_posters UUID[];
BEGIN
  v_affected_posters := ARRAY[]::UUID[];

  -- Find all unrevealed ratings older than 7 days
  FOR v_rating IN
    SELECT r.id, r.quest_id, r.rater_id, r.ratee_id, r.score,
           q.poster_id, q.worker_id
    FROM ratings r
    JOIN quests q ON r.quest_id = q.id
    WHERE r.revealed = FALSE
      AND r.submitted_at < NOW() - INTERVAL '7 days'
  LOOP
    -- Reveal this rating
    UPDATE ratings SET revealed = TRUE WHERE id = v_rating.id;

    -- Track affected users for reputation recalculation
    IF NOT v_rating.ratee_id = ANY(v_affected_posters) THEN
      v_affected_posters := array_append(v_affected_posters, v_rating.ratee_id);
    END IF;

    RAISE NOTICE 'Auto-revealed rating % for ratee %', v_rating.id, v_rating.ratee_id;
  END LOOP;

  -- Recalculate reputation for all affected users
  FOREACH v_ratee IN ARRAY v_affected_posters
  LOOP
    PERFORM recalculate_reputation(v_ratee);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairy_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_purchases ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Profiles are readable by everyone" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. Quests
CREATE POLICY "Quests are readable by everyone" ON quests FOR SELECT USING (true);
CREATE POLICY "Users can insert quests" ON quests FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "Users can update quests" ON quests FOR UPDATE USING (true); -- permits workers to accept and upload proofs

-- 3. Fairy Ledger
CREATE POLICY "Users can see their own ledger" ON fairy_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System definer only insert/writes" ON fairy_ledger FOR ALL USING (false);

-- 4. Quest Comments
CREATE POLICY "Comments are visible to all members" ON quest_comments FOR SELECT USING (true);
CREATE POLICY "Logged in users can comment" ON quest_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Ratings
CREATE POLICY "Ratings readable once revealed or if you are rater" ON ratings
  FOR SELECT USING (revealed = TRUE OR auth.uid() = rater_id);
CREATE POLICY "Users can insert ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- 6. Coin Purchases
CREATE POLICY "Users can see their own purchases" ON coin_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can post buy forms" ON coin_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full write access" ON coin_purchases FOR ALL USING (true);