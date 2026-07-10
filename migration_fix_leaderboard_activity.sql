-- =========================================================================
-- KINDRED GUILD — FIX: Leaderboard, Activity Seeding, Profile Stats
-- Date: 2026-07-10
-- =========================================================================

-- =========================================================================
-- 1. Fix leaderboard: Convert VIEW to SECURITY DEFINER function
--    (VIEWs inherit caller's RLS, so fairy_ledger was blocking cross-user data)
-- =========================================================================

DROP VIEW IF EXISTS leaderboard;

CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reputation_score INTEGER,
  quests_completed BIGINT,
  quests_posted BIGINT,
  wishes_backed BIGINT,
  guild_messages BIGINT,
  total_earned INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.reputation_score,
    COALESCE(qc.count, 0)::BIGINT,
    COALESCE(qp.count, 0)::BIGINT,
    COALESCE(wb.count, 0)::BIGINT,
    COALESCE(gm.count, 0)::BIGINT,
    COALESCE(earn.total, 0)::INTEGER,
    up.created_at
  FROM user_profiles up
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count FROM quests q WHERE q.worker_id = up.user_id AND q.status = 'approved' AND q.is_deleted = FALSE
  ) qc ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count FROM quests q WHERE q.poster_id = up.user_id AND q.is_deleted = FALSE
  ) qp ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count FROM wish_backings w WHERE w.user_id = up.user_id
  ) wb ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count FROM guild_messages g WHERE g.user_id = up.user_id AND g.is_deleted = FALSE
  ) gm ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(fl.amount), 0) AS total FROM fairy_ledger fl WHERE fl.user_id = up.user_id AND fl.amount > 0 AND fl.reason = 'quest_earning'
  ) earn ON true
  WHERE up.is_suspended = FALSE
  ORDER BY up.reputation_score DESC, qc.count DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 2. Seed more activity feed events from existing data
-- =========================================================================

-- Seed wish_created events
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT w.id, w.creator_id, w.title, w.created_at FROM wishes w WHERE w.is_deleted = FALSE ORDER BY w.created_at DESC LIMIT 20
  LOOP
    INSERT INTO activity_feed (actor_id, action_type, target_type, target_id, metadata, created_at)
    VALUES (r.creator_id, 'wish_created', 'wish', r.id, jsonb_build_object('title', r.title), r.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Seed quest_completed events (from approved quests)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT q.id, q.worker_id, q.title, q.created_at FROM quests q WHERE q.status = 'approved' AND q.is_deleted = FALSE AND q.worker_id IS NOT NULL ORDER BY q.created_at DESC LIMIT 20
  LOOP
    INSERT INTO activity_feed (actor_id, action_type, target_type, target_id, metadata, created_at)
    VALUES (r.worker_id, 'quest_completed', 'quest', r.id, jsonb_build_object('title', r.title), r.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Seed user_joined events
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT u.user_id, u.display_name, u.username, u.created_at FROM user_profiles u WHERE u.is_suspended = FALSE ORDER BY u.created_at DESC LIMIT 30
  LOOP
    INSERT INTO activity_feed (actor_id, action_type, target_type, target_id, metadata, created_at)
    VALUES (r.user_id, 'user_joined', 'user', r.user_id,
      jsonb_build_object('name', COALESCE(r.display_name, r.username)), r.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;


-- =========================================================================
-- 3. Add RLS policy for activity_feed INSERT (so log_activity works)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_feed' AND policyname = 'System can insert activity'
  ) THEN
    CREATE POLICY "System can insert activity" ON activity_feed FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Also add INSERT policy for notifications (so triggers can create them)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System can insert notifications'
  ) THEN
    CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;
