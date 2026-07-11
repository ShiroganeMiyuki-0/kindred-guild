-- ============================================
-- KINDRED GUILD — DIRECT MESSAGING TABLES
-- Run this in Supabase SQL Editor to enable DMs
-- ============================================

-- Conversations table (1-on-1 and group chats)
CREATE TABLE IF NOT EXISTS dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,                          -- NULL for 1-on-1, name for groups
  is_group BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',  -- 'admin' or 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_participants_conv ON dm_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conv ON dm_messages(conversation_id, created_at);

-- Add role column if upgrading from older version
ALTER TABLE dm_participants ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- RLS Policies
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

-- Users can see conversations they're part of
CREATE POLICY "Users can view their conversations" ON dm_conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can create conversations
CREATE POLICY "Users can create conversations" ON dm_conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can see participants of their conversations
CREATE POLICY "Users can view participants" ON dm_participants
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can add participants to conversations they're in
CREATE POLICY "Users can add participants" ON dm_participants
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

-- Users can see messages in their conversations
CREATE POLICY "Users can view messages" ON dm_messages
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages" ON dm_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages" ON dm_messages
  FOR UPDATE USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;

-- RPC: Get or create 1-on-1 conversation
CREATE OR REPLACE FUNCTION get_or_create_dm(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- Check if 1-on-1 conversation already exists
  SELECT dp1.conversation_id INTO existing_id
  FROM dm_participants dp1
  JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  JOIN dm_conversations c ON c.id = dp1.conversation_id
  WHERE dp1.user_id = auth.uid()
    AND dp2.user_id = p_other_user_id
    AND c.is_group = FALSE
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  -- Create new conversation
  INSERT INTO dm_conversations (is_group, created_by)
  VALUES (FALSE, auth.uid())
  RETURNING id INTO new_id;

  -- Add both participants
  INSERT INTO dm_participants (conversation_id, user_id)
  VALUES (new_id, auth.uid()), (new_id, p_other_user_id);

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Send DM message
CREATE OR REPLACE FUNCTION send_dm_message(p_conversation_id UUID, p_content TEXT)
RETURNS UUID AS $$
DECLARE
  msg_id UUID;
BEGIN
  -- Verify user is participant
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  INSERT INTO dm_messages (conversation_id, user_id, content)
  VALUES (p_conversation_id, auth.uid(), p_content)
  RETURNING id INTO msg_id;

  -- Update conversation timestamp
  UPDATE dm_conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get user's conversations with last message
CREATE OR REPLACE FUNCTION get_my_conversations()
RETURNS TABLE (
  conversation_id UUID,
  is_group BOOLEAN,
  name TEXT,
  other_user_id UUID,
  other_username TEXT,
  other_display_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.is_group,
    c.name,
    other_p.user_id,
    p.username,
    p.display_name,
    last_m.content,
    last_m.created_at,
    COALESCE(unread.cnt, 0),
    (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = c.id)
  FROM dm_conversations c
  JOIN dm_participants my_p ON my_p.conversation_id = c.id AND my_p.user_id = auth.uid()
  LEFT JOIN dm_participants other_p ON other_p.conversation_id = c.id AND other_p.user_id != auth.uid() AND c.is_group = FALSE
  LEFT JOIN user_profiles p ON p.user_id = other_p.user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at FROM dm_messages
    WHERE conversation_id = c.id AND is_deleted = FALSE
    ORDER BY created_at DESC LIMIT 1
  ) last_m ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as cnt FROM dm_messages
    WHERE conversation_id = c.id
      AND is_deleted = FALSE
      AND created_at > my_p.last_read_at
      AND user_id != auth.uid()
  ) unread ON TRUE
  ORDER BY COALESCE(last_m.created_at, c.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Create group conversation
CREATE OR REPLACE FUNCTION create_group_conversation(p_name TEXT, p_member_ids UUID[])
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  member_id UUID;
BEGIN
  -- Create the group conversation
  INSERT INTO dm_conversations (name, is_group, created_by)
  VALUES (p_name, TRUE, auth.uid())
  RETURNING id INTO new_id;

  -- Add creator as admin
  INSERT INTO dm_participants (conversation_id, user_id, role)
  VALUES (new_id, auth.uid(), 'admin');

  -- Add other members
  FOREACH member_id IN ARRAY p_member_ids
  LOOP
    IF member_id != auth.uid() THEN
      INSERT INTO dm_participants (conversation_id, user_id, role)
      VALUES (new_id, member_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
