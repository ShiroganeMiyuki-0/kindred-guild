-- =========================================================================
-- KINDRED GUILD — MIGRATION: Worker Verification Badges
-- Date: 2026-07-10
-- =========================================================================

-- Add verification column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL;

-- Admin function: verify a worker
CREATE OR REPLACE FUNCTION admin_verify_worker(p_user_id UUID, p_verify BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can verify workers.';
  END IF;

  UPDATE user_profiles SET
    is_verified = p_verify,
    verified_at = CASE WHEN p_verify THEN NOW() ELSE NULL END,
    verified_by = CASE WHEN p_verify THEN v_admin_id ELSE NULL END
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update leaderboard function to include verification
DROP FUNCTION IF EXISTS get_leaderboard(INTEGER);
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reputation_score INTEGER,
  is_verified BOOLEAN,
  quests_completed BIGINT,
  quests_posted BIGINT,
  wishes_backed BIGINT,
  guild_messages BIGINT,
  total_earned INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    up.user_id, up.username, up.display_name, up.avatar_url,
    up.reputation_score, COALESCE(up.is_verified, FALSE),
    COALESCE(qc.count, 0)::BIGINT,
    COALESCE(qp.count, 0)::BIGINT,
    COALESCE(wb.count, 0)::BIGINT,
    COALESCE(gm.count, 0)::BIGINT,
    COALESCE(earn.total, 0)::INTEGER,
    up.created_at
  FROM user_profiles up
  LEFT JOIN LATERAL (SELECT COUNT(*) AS count FROM quests q WHERE q.worker_id = up.user_id AND q.status = 'approved' AND q.is_deleted = FALSE) qc ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS count FROM quests q WHERE q.poster_id = up.user_id AND q.is_deleted = FALSE) qp ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS count FROM wish_backings w WHERE w.user_id = up.user_id) wb ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS count FROM guild_messages g WHERE g.user_id = up.user_id AND g.is_deleted = FALSE) gm ON true
  LEFT JOIN LATERAL (SELECT COALESCE(SUM(fl.amount), 0) AS total FROM fairy_ledger fl WHERE fl.user_id = up.user_id AND fl.amount > 0 AND fl.reason = 'quest_earning') earn ON true
  WHERE up.is_suspended = FALSE
  ORDER BY up.reputation_score DESC, qc.count DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Update get_profile_stats to include verification
DROP FUNCTION IF EXISTS get_profile_stats(UUID);
CREATE OR REPLACE FUNCTION get_profile_stats(p_user_id UUID)
RETURNS TABLE(
  quests_completed BIGINT,
  quests_posted BIGINT,
  wishes_created BIGINT,
  wishes_backed BIGINT,
  guild_messages BIGINT,
  total_earned INTEGER,
  total_spent INTEGER,
  coin_balance INTEGER,
  member_since TIMESTAMP WITH TIME ZONE,
  avg_rating NUMERIC,
  is_verified BOOLEAN
) AS $$
  SELECT
    (SELECT COUNT(*) FROM quests WHERE worker_id = p_user_id AND status = 'approved' AND is_deleted = FALSE),
    (SELECT COUNT(*) FROM quests WHERE poster_id = p_user_id AND is_deleted = FALSE),
    (SELECT COUNT(*) FROM wishes WHERE creator_id = p_user_id AND is_deleted = FALSE),
    (SELECT COUNT(*) FROM wish_backings WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM guild_messages WHERE user_id = p_user_id AND is_deleted = FALSE),
    COALESCE((SELECT SUM(amount) FROM fairy_ledger WHERE user_id = p_user_id AND amount > 0 AND reason = 'quest_earning'), 0),
    COALESCE((SELECT SUM(ABS(amount)) FROM fairy_ledger WHERE user_id = p_user_id AND amount < 0), 0),
    get_coin_balance(p_user_id),
    (SELECT created_at FROM user_profiles WHERE user_id = p_user_id),
    (SELECT AVG(score)::NUMERIC(3,1) FROM ratings WHERE ratee_id = p_user_id AND revealed = TRUE),
    COALESCE((SELECT is_verified FROM user_profiles WHERE user_id = p_user_id), FALSE);
$$ LANGUAGE sql SECURITY DEFINER;
