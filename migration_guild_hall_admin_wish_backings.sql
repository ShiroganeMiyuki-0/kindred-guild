-- =========================================================================
-- KINDRED GUILD — MIGRATION: Guild Hall, Admin Powers, Wish Backings
-- Date: 2026-07-10
-- Run this in Supabase SQL Editor AFTER the existing schema + migrations
-- =========================================================================

-- =========================================================================
-- 1. WISH BACKINGS — Users can back wishes with coins/UPI when voting
-- =========================================================================

CREATE TABLE IF NOT EXISTS wish_backings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  backing_type TEXT NOT NULL CHECK (backing_type IN ('free', 'coins', 'upi')),
  coin_amount INTEGER,
  upi_amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_wish_backer UNIQUE (wish_id, user_id),
  CONSTRAINT chk_backing_amount CHECK (
    (backing_type = 'free' AND coin_amount IS NULL AND upi_amount IS NULL) OR
    (backing_type = 'coins' AND coin_amount > 0 AND upi_amount IS NULL) OR
    (backing_type = 'upi' AND upi_amount > 0 AND coin_amount IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_wish_backings_wish_id ON wish_backings(wish_id);
CREATE INDEX IF NOT EXISTS idx_wish_backings_user_id ON wish_backings(user_id);

ALTER TABLE wish_backings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wish backings" ON wish_backings FOR SELECT USING (true);
CREATE POLICY "Users can create their own backings" ON wish_backings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own backings" ON wish_backings FOR DELETE USING (auth.uid() = user_id);

-- Add total backing columns to wishes table
ALTER TABLE wishes
ADD COLUMN IF NOT EXISTS total_coin_backing INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_upi_backing INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS backer_count INTEGER DEFAULT 0;

-- Function to back a wish (vote + optional coin/UPI backing)
CREATE OR REPLACE FUNCTION back_wish(
  p_wish_id UUID,
  p_backing_type TEXT,
  p_coin_amount INTEGER DEFAULT NULL,
  p_upi_amount INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_wish RECORD;
  v_balance INTEGER;
  v_commission INTEGER;
  v_required INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Check if wish exists and is active
  SELECT * INTO v_wish FROM wishes WHERE id = p_wish_id AND status = 'active' AND is_deleted = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found or inactive.';
  END IF;

  -- Can't back your own wish
  IF v_wish.creator_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot back your own wish.';
  END IF;

  -- Check if already backed
  IF EXISTS (SELECT 1 FROM wish_backings WHERE wish_id = p_wish_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'You have already backed this wish. Remove your existing backing first.';
  END IF;

  -- Validate and process backing
  IF p_backing_type = 'coins' THEN
    IF COALESCE(p_coin_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Coin amount must be greater than 0.';
    END IF;
    v_commission := CEIL(p_coin_amount * 0.1)::INTEGER;
    v_required := p_coin_amount + v_commission;
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < v_required THEN
      RAISE EXCEPTION 'Insufficient balance. Need % FC (backing + 10%% fee) but have % FC.', v_required, v_balance;
    END IF;
    -- Lock coins
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, -p_coin_amount, 'wish_backing_locked', NOW());
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, -v_commission, 'wish_backing_commission', NOW());
  ELSIF p_backing_type = 'upi' THEN
    IF COALESCE(p_upi_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'UPI amount must be greater than 0.';
    END IF;
    v_commission := CEIL(p_upi_amount * 0.1)::INTEGER;
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < v_commission THEN
      RAISE EXCEPTION 'Insufficient coins for UPI backing commission. Need % FC but have % FC.', v_commission, v_balance;
    END IF;
    -- Lock commission coins
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, -v_commission, 'wish_backing_commission', NOW());
  ELSIF p_backing_type != 'free' THEN
    RAISE EXCEPTION 'Invalid backing type.';
  END IF;

  -- Insert backing record
  INSERT INTO wish_backings (wish_id, user_id, backing_type, coin_amount, upi_amount)
  VALUES (p_wish_id, v_user_id, p_backing_type,
    CASE WHEN p_backing_type = 'coins' THEN p_coin_amount ELSE NULL END,
    CASE WHEN p_backing_type = 'upi' THEN p_upi_amount ELSE NULL END
  );

  -- Also insert a vote if not already voted
  INSERT INTO wish_votes (wish_id, voter_id)
  VALUES (p_wish_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Update wish totals
  UPDATE wishes SET
    total_coin_backing = COALESCE((SELECT SUM(coin_amount) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'coins'), 0),
    total_upi_backing = COALESCE((SELECT SUM(upi_amount) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'upi'), 0),
    backer_count = (SELECT COUNT(*) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type != 'free')
  WHERE id = p_wish_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a wish backing (refund)
CREATE OR REPLACE FUNCTION remove_wish_backing(p_wish_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_backing RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_backing FROM wish_backings WHERE wish_id = p_wish_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You have not backed this wish.';
  END IF;

  -- Refund coins if applicable
  IF v_backing.backing_type = 'coins' AND COALESCE(v_backing.coin_amount, 0) > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, v_backing.coin_amount, 'wish_backing_refund', NOW());
    -- Refund commission too
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, CEIL(v_backing.coin_amount * 0.1)::INTEGER, 'wish_backing_commission_refund', NOW());
  ELSIF v_backing.backing_type = 'upi' THEN
    -- Refund commission coins
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_user_id, CEIL(COALESCE(v_backing.upi_amount, 0) * 0.1)::INTEGER, 'wish_backing_commission_refund', NOW());
  END IF;

  -- Remove backing
  DELETE FROM wish_backings WHERE id = v_backing.id;

  -- Update wish totals
  UPDATE wishes SET
    total_coin_backing = COALESCE((SELECT SUM(coin_amount) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'coins'), 0),
    total_upi_backing = COALESCE((SELECT SUM(upi_amount) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type = 'upi'), 0),
    backer_count = (SELECT COUNT(*) FROM wish_backings WHERE wish_id = p_wish_id AND backing_type != 'free')
  WHERE id = p_wish_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated get_wish_votes to include backing totals
CREATE OR REPLACE FUNCTION get_wish_details(p_wish_id UUID)
RETURNS TABLE(votes BIGINT, coin_backing INTEGER, upi_backing INTEGER, backer_count INTEGER) AS $$
  SELECT
    (SELECT COUNT(*) FROM wish_votes WHERE wish_id = p_wish_id),
    COALESCE(w.total_coin_backing, 0),
    COALESCE(w.total_upi_backing, 0),
    COALESCE(w.backer_count, 0)
  FROM wishes w WHERE w.id = p_wish_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- =========================================================================
-- 2. GUILD HALL — Community discussion channels & messages
-- =========================================================================

CREATE TABLE IF NOT EXISTS guild_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'public' CHECK (channel_type IN ('public', 'announcement')),
  created_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES guild_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_messages_channel ON guild_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_guild_messages_user ON guild_messages(user_id);

ALTER TABLE guild_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted channels" ON guild_channels FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "Anyone can view non-deleted messages" ON guild_messages FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "Logged in users can send messages" ON guild_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own messages" ON guild_messages FOR UPDATE USING (auth.uid() = user_id);

-- Function to send a guild message
CREATE OR REPLACE FUNCTION send_guild_message(p_channel_id UUID, p_content TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_msg_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_user_id AND is_suspended = TRUE) THEN
    RAISE EXCEPTION 'Your account is suspended. You cannot send messages.';
  END IF;

  IF LENGTH(TRIM(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty.';
  END IF;

  IF LENGTH(p_content) > 2000 THEN
    RAISE EXCEPTION 'Message too long. Maximum 2000 characters.';
  END IF;

  INSERT INTO guild_messages (channel_id, user_id, content)
  VALUES (p_channel_id, v_user_id, TRIM(p_content))
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default channels
INSERT INTO guild_channels (name, description, channel_type) VALUES
  ('general', 'General discussion for all guild members', 'public'),
  ('quest-help', 'Ask questions about quests, get help from experienced members', 'public'),
  ('introductions', 'Introduce yourself to the guild!', 'public'),
  ('announcements', 'Official guild announcements', 'announcement')
ON CONFLICT DO NOTHING;


-- =========================================================================
-- 3. ADMIN POWERS — Content moderation, warnings, user management
-- =========================================================================

CREATE TABLE IF NOT EXISTS admin_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'final')),
  quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
  wish_id UUID REFERENCES wishes(id) ON DELETE SET NULL,
  message_id UUID REFERENCES guild_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_warnings_user ON admin_warnings(user_id);

ALTER TABLE admin_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own warnings" ON admin_warnings FOR SELECT USING (auth.uid() = user_id);

-- Admin function: send warning to user
CREATE OR REPLACE FUNCTION admin_send_warning(
  p_user_id UUID,
  p_reason TEXT,
  p_severity TEXT DEFAULT 'warning'
)
RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
  v_warning_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can send warnings.';
  END IF;

  IF p_severity NOT IN ('info', 'warning', 'final') THEN
    RAISE EXCEPTION 'Invalid severity level.';
  END IF;

  INSERT INTO admin_warnings (user_id, admin_id, reason, severity)
  VALUES (p_user_id, v_admin_id, TRIM(p_reason), p_severity)
  RETURNING id INTO v_warning_id;

  RETURN v_warning_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: suspend/unsuspend user
CREATE OR REPLACE FUNCTION admin_toggle_suspend(p_user_id UUID, p_suspend BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can suspend users.';
  END IF;

  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'You cannot suspend yourself.';
  END IF;

  UPDATE user_profiles SET is_suspended = p_suspend WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: delete any quest (soft delete)
CREATE OR REPLACE FUNCTION admin_delete_quest(p_quest_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_quest RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can delete quests.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found.';
  END IF;

  -- Refund locked coins to poster if quest was open/accepted
  IF v_quest.status IN ('open', 'accepted') THEN
    IF v_quest.payment_type = 'coins' AND COALESCE(v_quest.coin_amount, 0) > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.coin_amount, 'admin_quest_removal_refund', p_quest_id, NOW());
    END IF;
    IF v_quest.commission_coins > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.commission_coins, 'admin_commission_refund', p_quest_id, NOW());
    END IF;
  END IF;

  UPDATE quests SET is_deleted = TRUE, deleted_at = NOW() WHERE id = p_quest_id;

  -- Log warning if reason provided
  IF p_reason IS NOT NULL THEN
    INSERT INTO admin_warnings (user_id, admin_id, reason, severity, quest_id)
    VALUES (v_quest.poster_id, v_admin_id, p_reason, 'warning', p_quest_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: delete any wish
CREATE OR REPLACE FUNCTION admin_delete_wish(p_wish_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_wish RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can delete wishes.';
  END IF;

  SELECT * INTO v_wish FROM wishes WHERE id = p_wish_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found.';
  END IF;

  -- Refund wish creator's backing if any
  IF v_wish.wish_type = 'coins' AND COALESCE(v_wish.coin_amount, 0) > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, created_at)
    VALUES (v_wish.creator_id, v_wish.coin_amount, 'admin_wish_removal_refund', NOW());
  END IF;

  -- Refund all backings
  PERFORM remove_wish_backing(wb.wish_id)
  FROM wish_backings wb
  WHERE wb.wish_id = p_wish_id;

  UPDATE wishes SET is_deleted = TRUE, deleted_at = NOW() WHERE id = p_wish_id;

  IF p_reason IS NOT NULL THEN
    INSERT INTO admin_warnings (user_id, admin_id, reason, severity, wish_id)
    VALUES (v_wish.creator_id, v_admin_id, p_reason, 'warning', p_wish_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: delete guild message
CREATE OR REPLACE FUNCTION admin_delete_guild_message(p_message_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_msg RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can delete messages.';
  END IF;

  SELECT * INTO v_msg FROM guild_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found.';
  END IF;

  UPDATE guild_messages SET is_deleted = TRUE WHERE id = p_message_id;

  IF p_reason IS NOT NULL THEN
    INSERT INTO admin_warnings (user_id, admin_id, reason, severity, message_id)
    VALUES (v_msg.user_id, v_admin_id, p_reason, 'info', p_message_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: pin/unpin guild message
CREATE OR REPLACE FUNCTION admin_toggle_pin_message(p_message_id UUID, p_pin BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can pin messages.';
  END IF;

  UPDATE guild_messages SET is_pinned = p_pin WHERE id = p_message_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function: get all warnings for a user
CREATE OR REPLACE FUNCTION admin_get_user_warnings(p_user_id UUID)
RETURNS TABLE(
  warning_id UUID,
  reason TEXT,
  severity TEXT,
  admin_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    aw.id,
    aw.reason,
    aw.severity,
    COALESCE(up.display_name, up.username, 'Admin'),
    aw.created_at
  FROM admin_warnings aw
  JOIN user_profiles up ON aw.admin_id = up.user_id
  WHERE aw.user_id = p_user_id
  ORDER BY aw.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- Admin function: get platform stats
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS TABLE(
  total_users BIGINT,
  total_quests BIGINT,
  active_quests BIGINT,
  total_wishes BIGINT,
  pending_purchases BIGINT,
  total_guild_messages BIGINT,
  total_warnings BIGINT
) AS $$
  SELECT
    (SELECT COUNT(*) FROM user_profiles),
    (SELECT COUNT(*) FROM quests WHERE is_deleted = FALSE),
    (SELECT COUNT(*) FROM quests WHERE status IN ('open', 'accepted', 'submitted') AND is_deleted = FALSE),
    (SELECT COUNT(*) FROM wishes WHERE status = 'active' AND is_deleted = FALSE),
    (SELECT COUNT(*) FROM coin_purchases WHERE status = 'pending'),
    (SELECT COUNT(*) FROM guild_messages WHERE is_deleted = FALSE),
    (SELECT COUNT(*) FROM admin_warnings);
$$ LANGUAGE sql SECURITY DEFINER;
