-- =========================================================================
-- KINDRED GUILD — MIGRATION: Bookmarks, Analytics
-- Date: 2026-07-10
-- =========================================================================

-- =========================================================================
-- 1. QUEST BOOKMARKS — Save quests for later
-- =========================================================================

CREATE TABLE IF NOT EXISTS quest_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_bookmark UNIQUE (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_bookmarks_user ON quest_bookmarks(user_id);

ALTER TABLE quest_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bookmarks" ON quest_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookmarks" ON quest_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bookmarks" ON quest_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Toggle bookmark (add or remove)
CREATE OR REPLACE FUNCTION toggle_quest_bookmark(p_quest_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  SELECT EXISTS(SELECT 1 FROM quest_bookmarks WHERE user_id = v_user_id AND quest_id = p_quest_id) INTO v_exists;

  IF v_exists THEN
    DELETE FROM quest_bookmarks WHERE user_id = v_user_id AND quest_id = p_quest_id;
    RETURN FALSE; -- removed
  ELSE
    INSERT INTO quest_bookmarks (user_id, quest_id) VALUES (v_user_id, p_quest_id);
    RETURN TRUE; -- added
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's bookmarked quest IDs
CREATE OR REPLACE FUNCTION get_bookmarked_quest_ids()
RETURNS TABLE(quest_id UUID) AS $$
  SELECT qb.quest_id FROM quest_bookmarks qb WHERE qb.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 2. ADMIN ANALYTICS — Platform stats over time
-- =========================================================================

CREATE OR REPLACE FUNCTION admin_get_analytics()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM user_profiles),
    'new_users_7d', (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '7 days'),
    'new_users_30d', (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '30 days'),
    'total_quests', (SELECT COUNT(*) FROM quests WHERE is_deleted = FALSE),
    'active_quests', (SELECT COUNT(*) FROM quests WHERE status IN ('open', 'accepted', 'submitted') AND is_deleted = FALSE),
    'completed_quests', (SELECT COUNT(*) FROM quests WHERE status = 'approved' AND is_deleted = FALSE),
    'disputed_quests', (SELECT COUNT(*) FROM quests WHERE status = 'disputed'),
    'new_quests_7d', (SELECT COUNT(*) FROM quests WHERE created_at > NOW() - INTERVAL '7 days' AND is_deleted = FALSE),
    'total_wishes', (SELECT COUNT(*) FROM wishes WHERE is_deleted = FALSE),
    'total_wish_backings', (SELECT COUNT(*) FROM wish_backings),
    'total_coins_in_circulation', (SELECT COALESCE(SUM(amount), 0) FROM fairy_ledger WHERE amount > 0),
    'total_coins_locked', (SELECT COALESCE(SUM(ABS(amount)), 0) FROM fairy_ledger WHERE amount < 0 AND reason LIKE '%locked%'),
    'total_transactions', (SELECT COUNT(*) FROM fairy_ledger),
    'total_guild_messages', (SELECT COUNT(*) FROM guild_messages WHERE is_deleted = FALSE),
    'total_warnings', (SELECT COUNT(*) FROM admin_warnings),
    'pending_purchases', (SELECT COUNT(*) FROM coin_purchases WHERE status = 'pending'),
    'avg_reputation', (SELECT COALESCE(ROUND(AVG(reputation_score)::NUMERIC, 1), 0) FROM user_profiles WHERE reputation_score > 0),
    'quests_by_type', (
      SELECT json_build_object(
        'coins', COUNT(*) FILTER (WHERE payment_type = 'coins'),
        'upi', COUNT(*) FILTER (WHERE payment_type = 'upi'),
        'free', COUNT(*) FILTER (WHERE payment_type = 'free')
      ) FROM quests WHERE is_deleted = FALSE
    ),
    'users_by_week', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT DATE_TRUNC('week', created_at)::DATE AS week, COUNT(*) AS count
        FROM user_profiles
        WHERE created_at > NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week
      ) t
    ),
    'quests_by_week', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT DATE_TRUNC('week', created_at)::DATE AS week, COUNT(*) AS count
        FROM quests
        WHERE created_at > NOW() - INTERVAL '12 weeks' AND is_deleted = FALSE
        GROUP BY week ORDER BY week
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
