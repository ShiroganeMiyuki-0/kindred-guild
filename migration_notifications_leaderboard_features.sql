-- =========================================================================
-- KINDRED GUILD — MIGRATION: Notifications, Activity Feed, Leaderboard,
-- Dispute UI, Coin Ledger, Profile Stats
-- Date: 2026-07-10
-- =========================================================================

-- =========================================================================
-- 1. NOTIFICATIONS — In-app notification system
-- =========================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'quest_accepted', 'quest_submitted', 'quest_approved', 'wish_backed', 'guild_reply', 'admin_warning', 'dispute_filed', 'payment_received'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT, -- relative URL to navigate to
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can mark their notifications read" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications SET is_read = TRUE
  WHERE user_id = auth.uid() AND is_read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 2. ACTIVITY FEED — Platform-wide recent events
-- =========================================================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'quest_posted', 'quest_completed', 'wish_created', 'wish_backed', 'user_joined', 'worker_available'
  target_type TEXT, -- 'quest', 'wish', 'user', 'worker_post'
  target_id UUID,
  metadata JSONB, -- extra data like quest title, wish title, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view activity feed" ON activity_feed FOR SELECT USING (true);

-- Function to log an activity
CREATE OR REPLACE FUNCTION log_activity(
  p_actor_id UUID,
  p_action_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO activity_feed (actor_id, action_type, target_type, target_id, metadata)
  VALUES (p_actor_id, p_action_type, p_target_type, p_target_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed some initial activity (from existing data)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT q.id, q.poster_id, q.title, q.created_at FROM quests q WHERE q.is_deleted = FALSE ORDER BY q.created_at DESC LIMIT 20
  LOOP
    INSERT INTO activity_feed (actor_id, action_type, target_type, target_id, metadata, created_at)
    VALUES (r.poster_id, 'quest_posted', 'quest', r.id, jsonb_build_object('title', r.title), r.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;


-- =========================================================================
-- 3. DISPUTE FILING — Add frontend-callable dispute function
-- =========================================================================

CREATE OR REPLACE FUNCTION file_dispute(p_quest_id UUID, p_reason TEXT)
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

  -- Only poster or worker can file dispute
  IF v_quest.poster_id != v_user_id AND v_quest.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Only quest participants can file disputes.';
  END IF;

  -- Only submitted or accepted quests can be disputed
  IF v_quest.status NOT IN ('submitted', 'accepted') THEN
    RAISE EXCEPTION 'Only active quests can be disputed.';
  END IF;

  UPDATE quests SET status = 'disputed' WHERE id = p_quest_id;

  -- Notify the other party
  IF v_quest.poster_id = v_user_id THEN
    PERFORM create_notification(v_quest.worker_id, 'dispute_filed',
      'Dispute Filed', 'A dispute has been filed on quest: ' || v_quest.title,
      'quest-detail.html?id=' || p_quest_id);
  ELSE
    PERFORM create_notification(v_quest.poster_id, 'dispute_filed',
      'Dispute Filed', 'A dispute has been filed on quest: ' || v_quest.title,
      'quest-detail.html?id=' || p_quest_id);
  END IF;

  -- Log activity
  PERFORM log_activity(v_user_id, 'dispute_filed', 'quest', p_quest_id,
    jsonb_build_object('title', v_quest.title, 'reason', p_reason));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 4. NOTIFICATION TRIGGERS — Auto-create notifications on key events
-- =========================================================================

-- Trigger: When a quest is accepted, notify the poster
CREATE OR REPLACE FUNCTION notify_quest_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'open' AND NEW.worker_id IS NOT NULL THEN
    PERFORM create_notification(NEW.poster_id, 'quest_accepted',
      'Quest Accepted!', 'Someone accepted your quest: ' || NEW.title,
      'quest-detail.html?id=' || NEW.id);
    PERFORM log_activity(NEW.worker_id, 'quest_accepted', 'quest', NEW.id,
      jsonb_build_object('title', NEW.title));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_quest_accepted ON quests;
CREATE TRIGGER tr_notify_quest_accepted
  AFTER UPDATE ON quests
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'open')
  EXECUTE FUNCTION notify_quest_accepted();

-- Trigger: When a quest is submitted, notify the poster
CREATE OR REPLACE FUNCTION notify_quest_submitted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'accepted' THEN
    PERFORM create_notification(NEW.poster_id, 'quest_submitted',
      'Work Submitted!', 'Your worker submitted proof for: ' || NEW.title,
      'quest-detail.html?id=' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_quest_submitted ON quests;
CREATE TRIGGER tr_notify_quest_submitted
  AFTER UPDATE ON quests
  FOR EACH ROW
  WHEN (NEW.status = 'submitted' AND OLD.status = 'accepted')
  EXECUTE FUNCTION notify_quest_submitted();

-- Trigger: When a quest is approved, notify the worker
CREATE OR REPLACE FUNCTION notify_quest_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'submitted' THEN
    IF NEW.worker_id IS NOT NULL THEN
      PERFORM create_notification(NEW.worker_id, 'payment_received',
        'Quest Approved! 🎉', 'Your work on "' || NEW.title || '" has been approved. Payment released!',
        'quest-detail.html?id=' || NEW.id);
      PERFORM log_activity(NEW.worker_id, 'quest_completed', 'quest', NEW.id,
        jsonb_build_object('title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_quest_approved ON quests;
CREATE TRIGGER tr_notify_quest_approved
  AFTER UPDATE ON quests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'submitted')
  EXECUTE FUNCTION notify_quest_approved();


-- =========================================================================
-- 5. LEADERBOARD VIEW — Materialized convenience
-- =========================================================================

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  up.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  up.reputation_score,
  COALESCE(quests_completed.count, 0) AS quests_completed,
  COALESCE(quests_posted.count, 0) AS quests_posted,
  COALESCE(wish_backings.count, 0) AS wishes_backed,
  COALESCE(guild_msgs.count, 0) AS guild_messages,
  COALESCE(earnings.total, 0) AS total_earned,
  up.created_at
FROM user_profiles up
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count FROM quests q WHERE q.worker_id = up.user_id AND q.status = 'approved' AND q.is_deleted = FALSE
) quests_completed ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count FROM quests q WHERE q.poster_id = up.user_id AND q.is_deleted = FALSE
) quests_posted ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count FROM wish_backings wb WHERE wb.user_id = up.user_id
) wish_backings ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count FROM guild_messages gm WHERE gm.user_id = up.user_id AND gm.is_deleted = FALSE
) guild_msgs ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(fl.amount), 0) AS total FROM fairy_ledger fl WHERE fl.user_id = up.user_id AND fl.amount > 0 AND fl.reason = 'quest_earning'
) earnings ON true
WHERE up.is_suspended = FALSE
ORDER BY up.reputation_score DESC, quests_completed DESC;


-- =========================================================================
-- 6. COIN LEDGER RPC — Get user's full transaction history
-- =========================================================================

CREATE OR REPLACE FUNCTION get_coin_ledger(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
  id UUID,
  amount INTEGER,
  reason TEXT,
  quest_id UUID,
  quest_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  balance_after INTEGER
) AS $$
  SELECT
    fl.id,
    fl.amount,
    fl.reason,
    fl.quest_id,
    q.title,
    fl.created_at,
    SUM(fl.amount) OVER (ORDER BY fl.created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::INTEGER AS balance_after
  FROM fairy_ledger fl
  LEFT JOIN quests q ON fl.quest_id = q.id
  WHERE fl.user_id = auth.uid()
  ORDER BY fl.created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 7. ENHANCED PROFILE STATS
-- =========================================================================

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
  avg_rating NUMERIC
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
    (SELECT AVG(score)::NUMERIC(3,1) FROM ratings WHERE ratee_id = p_user_id AND revealed = TRUE);
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 8. RLS for new tables
-- =========================================================================

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view activity" ON activity_feed FOR SELECT USING (true);
