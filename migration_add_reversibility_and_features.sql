-- Migration: Add reversibility, soft delete, and new features
-- Date: 2026-07-05

-- 1. Add soft delete and edit tracking to quests table
ALTER TABLE quests
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- 2. Add onboarding tracking to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- 3. Create worker_posts table for "Adventurers for Hire"
CREATE TABLE IF NOT EXISTS worker_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  preferred_payment TEXT CHECK (preferred_payment IN ('free', 'coins', 'upi', 'any')),
  min_reward INTEGER,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_posts_user_id ON worker_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_posts_is_deleted ON worker_posts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_quests_is_deleted ON quests(is_deleted);

-- 5. Create action_log table for reversibility tracking
CREATE TABLE IF NOT EXISTS action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'quest_created', 'quest_edited', 'quest_deleted', 'quest_cancelled', 'worker_post_created', etc.
  quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
  worker_post_id UUID REFERENCES worker_posts(id) ON DELETE SET NULL,
  old_data JSONB,
  new_data JSONB,
  can_undo BOOLEAN DEFAULT TRUE,
  undo_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_log_user_id ON action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_action_log_quest_id ON action_log(quest_id);

-- 6. Function to soft delete a quest
CREATE OR REPLACE FUNCTION soft_delete_quest(p_quest_id UUID)
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
  
  -- Only poster can delete, and only if status is 'open'
  IF v_quest.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the quest poster can delete this quest.';
  END IF;
  
  IF v_quest.status != 'open' THEN
    RAISE EXCEPTION 'Only open quests can be deleted.';
  END IF;
  
  -- Soft delete
  UPDATE quests 
  SET is_deleted = TRUE, deleted_at = NOW()
  WHERE id = p_quest_id;
  
  -- Log the action
  INSERT INTO action_log (user_id, action_type, quest_id, old_data, new_data, can_undo, undo_until)
  VALUES (v_user_id, 'quest_deleted', p_quest_id, row_to_json(v_quest), NULL, TRUE, NOW() + INTERVAL '24 hours');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to restore a deleted quest
CREATE OR REPLACE FUNCTION restore_quest(p_quest_id UUID)
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
    RAISE EXCEPTION 'Only the quest poster can restore this quest.';
  END IF;
  
  IF NOT v_quest.is_deleted THEN
    RAISE EXCEPTION 'Quest is not deleted.';
  END IF;
  
  -- Restore
  UPDATE quests 
  SET is_deleted = FALSE, deleted_at = NULL
  WHERE id = p_quest_id;
  
  -- Log the action
  INSERT INTO action_log (user_id, action_type, quest_id, old_data, new_data)
  VALUES (v_user_id, 'quest_restored', p_quest_id, NULL, row_to_json(v_quest));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to edit a quest
CREATE OR REPLACE FUNCTION edit_quest(
  p_quest_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_coin_amount INTEGER DEFAULT NULL,
  p_upi_amount INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
  v_old_data JSONB;
  v_new_data JSONB;
  v_coin_diff INTEGER;
  v_balance INTEGER;
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
    RAISE EXCEPTION 'Only the quest poster can edit this quest.';
  END IF;
  
  -- Only allow edits if quest is 'open' or 'accepted' (not submitted/approved/disputed)
  IF v_quest.status NOT IN ('open', 'accepted') THEN
    RAISE EXCEPTION 'Quest cannot be edited in current status.';
  END IF;
  
  -- Store old data
  v_old_data := row_to_json(v_quest);
  
  -- Handle coin amount changes
  IF p_coin_amount IS NOT NULL AND p_coin_amount != v_quest.coin_amount THEN
    IF v_quest.payment_type = 'coins' THEN
      v_coin_diff := p_coin_amount - v_quest.coin_amount;
      
      -- If increasing reward, check balance
      IF v_coin_diff > 0 THEN
        v_balance := get_coin_balance(v_user_id);
        IF v_balance < v_coin_diff THEN
          RAISE EXCEPTION 'Insufficient balance to increase reward by % FC.', v_coin_diff;
        END IF;
        -- Deduct additional coins
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_user_id, -v_coin_diff, 'reward_increase_locked', p_quest_id, NOW());
      ELSIF v_coin_diff < 0 THEN
        -- Refund the difference
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_user_id, -v_coin_diff, 'reward_decrease_refund', p_quest_id, NOW());
      END IF;
    END IF;
  END IF;
  
  -- Update quest fields
  UPDATE quests 
  SET 
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    tags = COALESCE(p_tags, tags),
    coin_amount = COALESCE(p_coin_amount, coin_amount),
    upi_amount = COALESCE(p_upi_amount, upi_amount),
    edited_at = NOW(),
    edit_history = edit_history || jsonb_build_array(jsonb_build_object('edited_at', NOW(), 'old_data', v_old_data))
  WHERE id = p_quest_id;
  
  -- Get new data
  SELECT row_to_json(q) INTO v_new_data FROM quests q WHERE id = p_quest_id;
  
  -- Log the action
  INSERT INTO action_log (user_id, action_type, quest_id, old_data, new_data, can_undo, undo_until)
  VALUES (v_user_id, 'quest_edited', p_quest_id, v_old_data, v_new_data, TRUE, NOW() + INTERVAL '24 hours');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to post worker availability
CREATE OR REPLACE FUNCTION post_worker_availability(
  p_title TEXT,
  p_description TEXT,
  p_tags TEXT[],
  p_preferred_payment TEXT,
  p_min_reward INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_post_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  
  INSERT INTO worker_posts (user_id, title, description, tags, preferred_payment, min_reward, created_at)
  VALUES (v_user_id, p_title, p_description, p_tags, p_preferred_payment, p_min_reward, NOW())
  RETURNING id INTO v_post_id;
  
  -- Log the action
  INSERT INTO action_log (user_id, action_type, worker_post_id, new_data)
  VALUES (v_user_id, 'worker_post_created', v_post_id, (SELECT row_to_json(wp) FROM worker_posts wp WHERE id = v_post_id));
  
  RETURN v_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to soft delete worker post
CREATE OR REPLACE FUNCTION soft_delete_worker_post(p_post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_post RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  
  SELECT * INTO v_post FROM worker_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker post not found.';
  END IF;
  
  IF v_post.user_id != v_user_id THEN
    RAISE EXCEPTION 'Only the post author can delete this post.';
  END IF;
  
  UPDATE worker_posts 
  SET is_deleted = TRUE, deleted_at = NOW()
  WHERE id = p_post_id;
  
  INSERT INTO action_log (user_id, action_type, worker_post_id, old_data, new_data, can_undo, undo_until)
  VALUES (v_user_id, 'worker_post_deleted', p_post_id, row_to_json(v_post), NULL, TRUE, NOW() + INTERVAL '24 hours');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Update RLS policies for new tables
ALTER TABLE worker_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view non-deleted worker posts"
  ON worker_posts FOR SELECT
  USING (is_deleted = FALSE);

CREATE POLICY "Users can manage their own worker posts"
  ON worker_posts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own action log"
  ON action_log FOR SELECT
  USING (auth.uid() = user_id);
