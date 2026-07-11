-- ============================================
-- FIX: Infinite recursion in DM RLS policies
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop ALL existing DM policies to start fresh
DROP POLICY IF EXISTS "Users can view their conversations" ON dm_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON dm_conversations;
DROP POLICY IF EXISTS "Users can view participants" ON dm_participants;
DROP POLICY IF EXISTS "Users can add participants" ON dm_participants;
DROP POLICY IF EXISTS "Users can view messages" ON dm_messages;
DROP POLICY IF EXISTS "Users can send messages" ON dm_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON dm_messages;

-- Step 2: Create a helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_dm_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 3: Recreate policies using the helper function (no self-reference)

-- dm_conversations: users can see conversations they're in
CREATE POLICY "dm_conv_select" ON dm_conversations
  FOR SELECT USING (is_dm_participant(id, auth.uid()));

-- dm_conversations: any authenticated user can create
CREATE POLICY "dm_conv_insert" ON dm_conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- dm_participants: users can see participants of their conversations
CREATE POLICY "dm_part_select" ON dm_participants
  FOR SELECT USING (is_dm_participant(conversation_id, auth.uid()));

-- dm_participants: users can add participants to conversations they're in
CREATE POLICY "dm_part_insert" ON dm_participants
  FOR INSERT WITH CHECK (
    is_dm_participant(conversation_id, auth.uid())
    OR user_id = auth.uid()
  );

-- dm_messages: users can see messages in their conversations
CREATE POLICY "dm_msg_select" ON dm_messages
  FOR SELECT USING (is_dm_participant(conversation_id, auth.uid()));

-- dm_messages: users can send messages to their conversations
CREATE POLICY "dm_msg_insert" ON dm_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_dm_participant(conversation_id, auth.uid())
  );

-- dm_messages: users can update their own messages (soft delete)
CREATE POLICY "dm_msg_update" ON dm_messages
  FOR UPDATE USING (user_id = auth.uid());

-- Step 4: Also add role column if missing
ALTER TABLE dm_participants ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- Step 5: Ensure realtime is enabled
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
