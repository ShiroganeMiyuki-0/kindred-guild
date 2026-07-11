-- ============================================
-- KINDRED GUILD — Rank System & Wish Granted
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add rank column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'D' 
CHECK (rank IN ('S', 'A', 'B', 'C', 'D'));

-- 2. Add rank_requirement column to quests
ALTER TABLE quests 
ADD COLUMN IF NOT EXISTS min_rank TEXT 
CHECK (min_rank IS NULL OR min_rank IN ('S', 'A', 'B', 'C', 'D'));

-- 3. Add pending_acceptance status support
-- (We'll use the existing status column, just adding a new valid value)
-- The check constraint might need updating - run this if needed:
-- ALTER TABLE quests DROP CONSTRAINT IF EXISTS quests_status_check;
-- ALTER TABLE quests ADD CONSTRAINT quests_status_check 
--   CHECK (status IN ('open', 'pending_acceptance', 'accepted', 'submitted', 'disputed', 'approved', 'cancelled'));

-- 4. Create function to calculate user rank
CREATE OR REPLACE FUNCTION calculate_user_rank(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  completed_count INTEGER;
  avg_rating NUMERIC;
  rep_score INTEGER;
  final_rank TEXT;
BEGIN
  -- Count completed quests (as worker)
  SELECT COUNT(*) INTO completed_count
  FROM quests
  WHERE worker_id = p_user_id AND status = 'approved';
  
  -- Get average rating
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating
  FROM ratings
  WHERE ratee_id = p_user_id;
  
  -- Get reputation score
  SELECT COALESCE(reputation_score, 0) INTO rep_score
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  -- Calculate rank based on performance
  -- S: 20+ completed, 4.5+ avg rating, 80+ rep
  -- A: 10+ completed, 4.0+ avg rating, 50+ rep
  -- B: 5+ completed, 3.5+ avg rating, 30+ rep
  -- C: 2+ completed, 3.0+ avg rating, 15+ rep
  -- D: everyone else
  
  IF completed_count >= 20 AND avg_rating >= 4.5 AND rep_score >= 80 THEN
    final_rank := 'S';
  ELSIF completed_count >= 10 AND avg_rating >= 4.0 AND rep_score >= 50 THEN
    final_rank := 'A';
  ELSIF completed_count >= 5 AND avg_rating >= 3.5 AND rep_score >= 30 THEN
    final_rank := 'B';
  ELSIF completed_count >= 2 AND avg_rating >= 3.0 AND rep_score >= 15 THEN
    final_rank := 'C';
  ELSE
    final_rank := 'D';
  END IF;
  
  -- Update the user's rank
  UPDATE user_profiles SET rank = final_rank WHERE user_id = p_user_id;
  
  RETURN final_rank;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to accept quest (worker side)
CREATE OR REPLACE FUNCTION worker_accept_quest(p_quest_id UUID, p_worker_id UUID)
RETURNS JSON AS $$
DECLARE
  quest_record RECORD;
  worker_rank TEXT;
  rank_order JSONB := '{"S": 5, "A": 4, "B": 3, "C": 2, "D": 1}';
  min_rank_val INT;
  worker_rank_val INT;
BEGIN
  -- Get quest details
  SELECT * INTO quest_record FROM quests WHERE id = p_quest_id AND status = 'open' AND is_deleted = false;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Quest not found or not open');
  END IF;
  
  -- Check if worker is the poster
  IF quest_record.poster_id = p_worker_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot accept your own quest');
  END IF;
  
  -- Get worker rank
  SELECT COALESCE(rank, 'D') INTO worker_rank FROM user_profiles WHERE user_id = p_worker_id;
  
  -- Check rank requirement
  IF quest_record.min_rank IS NOT NULL THEN
    worker_rank_val := (rank_order->>worker_rank)::INT;
    min_rank_val := (rank_order->>quest_record.min_rank)::INT;
    
    IF worker_rank_val < min_rank_val THEN
      RETURN json_build_object('success', false, 'error', 'Your rank (' || worker_rank || ') does not meet the minimum requirement (' || quest_record.min_rank || ')');
    END IF;
  END IF;
  
  -- Set quest to pending_acceptance
  UPDATE quests 
  SET status = 'pending_acceptance', worker_id = p_worker_id
  WHERE id = p_quest_id;
  
  -- Create notification for poster
  INSERT INTO notifications (user_id, type, title, message, quest_id)
  VALUES (quest_record.poster_id, 'quest_pending', 'Worker wants to accept your quest', 'A worker wants to accept "' || quest_record.title || '". Approve or reject them.', p_quest_id);
  
  RETURN json_build_object('success', true, 'status', 'pending_acceptance');
END;
$$ LANGUAGE plpgsql;

-- 6. Create function for poster to approve/reject worker
CREATE OR REPLACE FUNCTION poster_approve_worker(p_quest_id UUID, p_poster_id UUID, p_approved BOOLEAN)
RETURNS JSON AS $$
DECLARE
  quest_record RECORD;
  worker_record RECORD;
BEGIN
  -- Verify poster owns the quest
  SELECT * INTO quest_record FROM quests 
  WHERE id = p_quest_id AND poster_id = p_poster_id AND status = 'pending_acceptance';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Quest not found or not pending acceptance');
  END IF;
  
  IF p_approved THEN
    -- Accept the worker
    UPDATE quests SET status = 'accepted' WHERE id = p_quest_id;
    
    -- Notify worker
    INSERT INTO notifications (user_id, type, title, message, quest_id)
    VALUES (quest_record.worker_id, 'quest_approved', 'Your application was approved!', 'The poster approved your application for "' || quest_record.title || '". Get to work!', p_quest_id);
    
    RETURN json_build_object('success', true, 'status', 'accepted');
  ELSE
    -- Reject the worker - reset quest to open
    UPDATE quests SET status = 'open', worker_id = NULL WHERE id = p_quest_id;
    
    -- Notify worker
    INSERT INTO notifications (user_id, type, title, message, quest_id)
    VALUES (quest_record.worker_id, 'quest_rejected', 'Application not selected', 'The poster chose a different worker for "' || quest_record.title || '". Keep trying!', p_quest_id);
    
    RETURN json_build_object('success', true, 'status', 'open');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function for worker to drop quest
CREATE OR REPLACE FUNCTION worker_drop_quest(p_quest_id UUID, p_worker_id UUID)
RETURNS JSON AS $$
DECLARE
  quest_record RECORD;
BEGIN
  -- Verify worker is assigned to quest
  SELECT * INTO quest_record FROM quests 
  WHERE id = p_quest_id AND worker_id = p_worker_id 
  AND status IN ('accepted', 'pending_acceptance');
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Quest not found or you are not assigned');
  END IF;
  
  -- Reset quest to open
  UPDATE quests SET status = 'open', worker_id = NULL WHERE id = p_quest_id;
  
  -- Notify poster
  INSERT INTO notifications (user_id, type, title, message, quest_id)
  VALUES (quest_record.poster_id, 'worker_dropped', 'Worker dropped your quest', 'The worker dropped "' || quest_record.title || '". Your quest is now open again.', p_quest_id);
  
  RETURN json_build_object('success', true, 'status', 'open');
END;
$$ LANGUAGE plpgsql;

-- 8. Update existing users with calculated ranks
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  FOR user_rec IN SELECT user_id FROM user_profiles LOOP
    PERFORM calculate_user_rank(user_rec.user_id);
  END LOOP;
END $$;

-- 9. Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION worker_accept_quest(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION poster_approve_worker(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION worker_drop_quest(UUID, UUID) TO authenticated;
