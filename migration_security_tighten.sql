-- =========================================================================
-- KINDRED GUILD — SECURITY HARDENING
-- Run this AFTER the main schema and all other migrations.
-- Fixes RLS policy gaps and adds missing security columns.
-- =========================================================================

-- 1. Add missing columns to user_profiles if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_verified') THEN
    ALTER TABLE user_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Add missing columns to quests if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'tags') THEN
    ALTER TABLE quests ADD COLUMN tags TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'edited_at') THEN
    ALTER TABLE quests ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'edit_history') THEN
    ALTER TABLE quests ADD COLUMN edit_history JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'is_deleted') THEN
    ALTER TABLE quests ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Create action_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id),
  action_type TEXT NOT NULL,
  quest_id UUID,
  old_data JSONB,
  new_data JSONB,
  can_undo BOOLEAN DEFAULT FALSE,
  undo_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TIGHTEN RLS POLICIES

-- Fix coin_purchases: Admins should NOT have blanket write access
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins have full write access" ON coin_purchases;

-- Create a proper admin-only policy that restricts to specific operations
-- (The actual approve/reject is done via SECURITY DEFINER functions, so we just need read access for admins)
CREATE POLICY "Admins can read all purchases" ON coin_purchases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE)
    OR auth.uid() = user_id
  );

-- Fix quests UPDATE policy: should be restricted to poster/worker only
DROP POLICY IF EXISTS "Users can update quests" ON quests;

CREATE POLICY "Poster can update own quests" ON quests
  FOR UPDATE USING (auth.uid() = poster_id);

CREATE POLICY "Worker can update accepted quests" ON quests
  FOR UPDATE USING (
    auth.uid() = worker_id 
    AND status IN ('accepted', 'submitted')
  );

-- 5. Add RLS for action_log
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own actions" ON action_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can see all actions" ON action_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE)
  );

-- 6. Ensure admin functions have proper admin checks
-- (Verify they already exist - this is a safety net)

-- 7. Create a function to clean up demo/test accounts
-- Admin-only: marks demo accounts as suspended
CREATE OR REPLACE FUNCTION admin_cleanup_demo_accounts()
RETURNS TABLE(cleaned_username TEXT, action_taken TEXT) AS $$
DECLARE
  v_admin_id UUID;
  v_demo RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Only admins can clean up demo accounts.';
  END IF;

  -- Find accounts that look like demos (customize this query as needed)
  FOR v_demo IN
    SELECT user_id, username 
    FROM user_profiles 
    WHERE username ILIKE '%demo%' 
       OR username ILIKE '%test%'
       OR username ILIKE '%example%'
       OR display_name ILIKE '%demo%'
       OR display_name ILIKE '%test account%'
  LOOP
    -- Suspend the demo account
    UPDATE user_profiles SET is_suspended = TRUE WHERE user_id = v_demo.user_id;
    cleaned_username := v_demo.username;
    action_taken := 'suspended';
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add rate limiting for wish backing (prevent spam)
CREATE OR REPLACE FUNCTION back_wish(
  p_wish_id UUID,
  p_backing_type TEXT,
  p_coin_amount INTEGER DEFAULT NULL,
  p_upi_amount INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER;
  v_backing_id UUID;
  v_recent_backings INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Rate limit: max 10 backings per hour
  SELECT COUNT(*) INTO v_recent_backings
  FROM wish_backings
  WHERE user_id = v_user_id AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent_backings >= 10 THEN
    RAISE EXCEPTION 'Too many backings. Please wait before backing more wishes.';
  END IF;

  -- Check if already backed
  IF EXISTS (SELECT 1 FROM wish_backings WHERE wish_id = p_wish_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'You have already backed this wish.';
  END IF;

  -- Validate backing type
  IF p_backing_type NOT IN ('free', 'coins', 'upi') THEN
    RAISE EXCEPTION 'Invalid backing type.';
  END IF;

  -- For coin backings, check balance
  IF p_backing_type = 'coins' THEN
    IF COALESCE(p_coin_amount, 0) < 10 THEN
      RAISE EXCEPTION 'Minimum coin backing is 10 FC.';
    END IF;
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < p_coin_amount THEN
      RAISE EXCEPTION 'Insufficient balance. You have % FC but tried to back with % FC.', v_balance, p_coin_amount;
    END IF;
    -- Deduct coins
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, -p_coin_amount, 'wish_backing', NOW());
  END IF;

  -- For UPI backings, require commission in coins
  IF p_backing_type = 'upi' THEN
    IF COALESCE(p_upi_amount, 0) < 10 THEN
      RAISE EXCEPTION 'Minimum UPI backing is ₹10.';
    END IF;
    -- Commission: 10% of UPI amount in coins
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < CEIL(p_upi_amount * 0.1) THEN
      RAISE EXCEPTION 'You need % FC for commission (10%% of ₹% pledge). You have % FC.', CEIL(p_upi_amount * 0.1), p_upi_amount, v_balance;
    END IF;
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, -CEIL(p_upi_amount * 0.1), 'wish_upi_commission', NOW());
  END IF;

  -- Create backing record
  INSERT INTO wish_backings (wish_id, user_id, backing_type, coin_amount, upi_amount)
  VALUES (p_wish_id, v_user_id, p_backing_type, 
    CASE WHEN p_backing_type = 'coins' THEN p_coin_amount ELSE NULL END,
    CASE WHEN p_backing_type = 'upi' THEN p_upi_amount ELSE NULL END
  )
  RETURNING id INTO v_backing_id;

  -- Update wish totals
  IF p_backing_type = 'coins' THEN
    UPDATE wishes SET 
      total_coin_backing = total_coin_backing + p_coin_amount,
      backer_count = backer_count + 1
    WHERE id = p_wish_id;
  ELSIF p_backing_type = 'upi' THEN
    UPDATE wishes SET 
      total_upi_backing = total_upi_backing + p_upi_amount,
      backer_count = backer_count + 1
    WHERE id = p_wish_id;
  ELSE
    UPDATE wishes SET backer_count = backer_count + 1 WHERE id = p_wish_id;
  END IF;

  RETURN v_backing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
