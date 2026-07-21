-- =========================================================================
-- KINDRED GUILD — ANNOUNCEMENTS & SUPPORTER FEEDBACK
-- Run this in the Supabase SQL Editor after the main schema.
-- =========================================================================

-- 1. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- normal, important, urgent
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT chk_priority CHECK (priority IN ('normal', 'important', 'urgent'))
);

-- Index for fast active-announcement lookups
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC);

-- RLS: everyone can read active announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements" ON announcements
  FOR SELECT USING (is_active = TRUE);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE)
  );


-- 2. WISH SUPPORTER FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS wish_supporter_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  rating INTEGER, -- 1-5 stars (optional)
  feedback_text TEXT, -- written feedback (optional)
  backing_type TEXT NOT NULL, -- coins, upi, free
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT chk_feedback_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  CONSTRAINT unique_wish_user_feedback UNIQUE (wish_id, user_id)
);

-- RLS for feedback
ALTER TABLE wish_supporter_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wish feedback" ON wish_supporter_feedback
  FOR SELECT USING (true);

CREATE POLICY "Users can submit their own feedback" ON wish_supporter_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON wish_supporter_feedback
  FOR UPDATE USING (auth.uid() = user_id);


-- 3. ADMIN RPC: Get active announcements
CREATE OR REPLACE FUNCTION get_active_announcements(p_limit INTEGER DEFAULT 5)
RETURNS SETOF announcements AS $$
  SELECT * FROM announcements
  WHERE is_active = TRUE
  ORDER BY 
    CASE priority 
      WHEN 'urgent' THEN 1 
      WHEN 'important' THEN 2 
      ELSE 3 
    END,
    created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;


-- 4. ADMIN RPC: Create announcement
CREATE OR REPLACE FUNCTION admin_create_announcement(
  p_title TEXT,
  p_content TEXT,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
  v_announcement_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Only admins can create announcements.';
  END IF;

  INSERT INTO announcements (title, content, priority, created_by)
  VALUES (p_title, p_content, p_priority, v_admin_id)
  RETURNING id INTO v_announcement_id;

  RETURN v_announcement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ADMIN RPC: Toggle announcement active status
CREATE OR REPLACE FUNCTION admin_toggle_announcement(
  p_announcement_id UUID,
  p_active BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Only admins can manage announcements.';
  END IF;

  UPDATE announcements 
  SET is_active = p_active, updated_at = NOW()
  WHERE id = p_announcement_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. ADMIN RPC: Delete announcement
CREATE OR REPLACE FUNCTION admin_delete_announcement(p_announcement_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Only admins can delete announcements.';
  END IF;

  DELETE FROM announcements WHERE id = p_announcement_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC: Submit wish supporter feedback
CREATE OR REPLACE FUNCTION submit_wish_feedback(
  p_wish_id UUID,
  p_rating INTEGER DEFAULT NULL,
  p_feedback_text TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_backing_type TEXT;
  v_feedback_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Check if user has a backing on this wish
  SELECT backing_type INTO v_backing_type
  FROM wish_backings
  WHERE wish_id = p_wish_id AND user_id = v_user_id;

  IF v_backing_type IS NULL THEN
    RAISE EXCEPTION 'You must have backed this wish to leave feedback.';
  END IF;

  -- Upsert feedback
  INSERT INTO wish_supporter_feedback (wish_id, user_id, rating, feedback_text, backing_type)
  VALUES (p_wish_id, v_user_id, p_rating, p_feedback_text, v_backing_type)
  ON CONFLICT (wish_id, user_id) 
  DO UPDATE SET 
    rating = COALESCE(EXCLUDED.rating, wish_supporter_feedback.rating),
    feedback_text = COALESCE(EXCLUDED.feedback_text, wish_supporter_feedback.feedback_text),
    created_at = NOW()
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. ADMIN ANALYTICS UPDATE: Include announcements count
CREATE OR REPLACE FUNCTION admin_get_analytics()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM user_profiles),
    'new_users_7d', (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '7 days'),
    'total_quests', (SELECT COUNT(*) FROM quests),
    'new_quests_7d', (SELECT COUNT(*) FROM quests WHERE created_at > NOW() - INTERVAL '7 days'),
    'active_quests', (SELECT COUNT(*) FROM quests WHERE status IN ('open', 'accepted', 'submitted')),
    'completed_quests', (SELECT COUNT(*) FROM quests WHERE status = 'approved'),
    'disputed_quests', (SELECT COUNT(*) FROM quests WHERE status = 'disputed'),
    'total_wishes', (SELECT COUNT(*) FROM wishes WHERE is_deleted = FALSE),
    'total_wish_backings', (SELECT COUNT(*) FROM wish_backings),
    'total_guild_messages', (SELECT COUNT(*) FROM guild_messages WHERE is_deleted = FALSE),
    'avg_reputation', (SELECT COALESCE(ROUND(AVG(reputation_score)::NUMERIC / 10, 1), 0) FROM user_profiles WHERE reputation_score > 0),
    'total_coins_in_circulation', (SELECT COALESCE(SUM(amount), 0) FROM fairy_ledger WHERE amount > 0),
    'total_coins_locked', (SELECT COALESCE(ABS(SUM(amount)), 0) FROM fairy_ledger WHERE amount < 0 AND reason LIKE '%locked%'),
    'total_transactions', (SELECT COUNT(*) FROM fairy_ledger),
    'pending_purchases', (SELECT COUNT(*) FROM coin_purchases WHERE status = 'pending'),
    'total_announcements', (SELECT COUNT(*) FROM announcements WHERE is_active = TRUE),
    'quests_by_type', json_build_object(
      'coins', (SELECT COUNT(*) FROM quests WHERE payment_type = 'coins'),
      'upi', (SELECT COUNT(*) FROM quests WHERE payment_type = 'upi'),
      'free', (SELECT COUNT(*) FROM quests WHERE payment_type = 'free')
    ),
    'users_by_week', (
      SELECT COALESCE(json_agg(week_data ORDER BY week), '[]'::JSON)
      FROM (
        SELECT 
          TO_CHAR(DATE_TRUNC('week', created_at), 'MM/DD') AS week,
          COUNT(*) AS count
        FROM user_profiles
        WHERE created_at > NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
      ) week_data
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
