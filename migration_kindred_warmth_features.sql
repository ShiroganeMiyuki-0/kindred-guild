-- KINDRED GUILD — Welcome Circle, Kindred Prompts, and Buddy Quests
-- Small, low-pressure community features with RLS and authenticated RPCs.

CREATE TABLE IF NOT EXISTS kindred_introductions (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  hello TEXT NOT NULL,
  looking_for TEXT NOT NULL DEFAULT 'A gentle place to begin',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kindred_introductions_hello_length CHECK (char_length(hello) BETWEEN 1 AND 280),
  CONSTRAINT kindred_introductions_looking_for_length CHECK (char_length(looking_for) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS kindred_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kindred_prompt_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES kindred_prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, user_id),
  CONSTRAINT kindred_prompt_response_length CHECK (char_length(response_text) BETWEEN 1 AND 500)
);

CREATE TABLE IF NOT EXISTS buddy_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  time_note TEXT NOT NULL DEFAULT 'No rush — agree on a time together',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT buddy_quest_title_length CHECK (char_length(title) BETWEEN 3 AND 100),
  CONSTRAINT buddy_quest_description_length CHECK (char_length(description) BETWEEN 10 AND 600),
  CONSTRAINT buddy_quest_time_note_length CHECK (char_length(time_note) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS buddy_quest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_quest_id UUID NOT NULL REFERENCES buddy_quests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'buddy')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buddy_quest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kindred_introductions_visible ON kindred_introductions(is_visible, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kindred_prompt_responses_prompt ON kindred_prompt_responses(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddy_quests_open ON buddy_quests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddy_quest_participants_quest ON buddy_quest_participants(buddy_quest_id);

ALTER TABLE kindred_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kindred_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kindred_prompt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_quest_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visible introductions are public" ON kindred_introductions;
CREATE POLICY "Visible introductions are public" ON kindred_introductions
  FOR SELECT USING (is_visible = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Active prompts are public" ON kindred_prompts;
CREATE POLICY "Active prompts are public" ON kindred_prompts
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Buddy quests are public" ON buddy_quests;
CREATE POLICY "Buddy quests are public" ON buddy_quests
  FOR SELECT USING (status = 'open' OR auth.uid() = host_id);

DROP POLICY IF EXISTS "Buddy participants are visible to members" ON buddy_quest_participants;
CREATE POLICY "Buddy participants are visible to members" ON buddy_quest_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION get_welcome_circle(p_limit INTEGER DEFAULT 12)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  hello TEXT,
  looking_for TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT i.user_id, up.display_name, up.username, up.avatar_url, i.hello, i.looking_for, i.created_at
  FROM kindred_introductions i
  JOIN user_profiles up ON up.user_id = i.user_id
  WHERE i.is_visible = TRUE AND COALESCE(up.is_suspended, FALSE) = FALSE
  ORDER BY i.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION save_welcome_intro(p_hello TEXT, p_looking_for TEXT DEFAULT 'A gentle place to begin')
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hello TEXT := btrim(COALESCE(p_hello, ''));
  v_looking_for TEXT := btrim(COALESCE(p_looking_for, ''));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF char_length(v_hello) < 1 OR char_length(v_hello) > 280 THEN
    RAISE EXCEPTION 'Your hello should be between 1 and 280 characters.';
  END IF;
  IF char_length(v_looking_for) < 1 OR char_length(v_looking_for) > 120 THEN
    RAISE EXCEPTION 'Your intention should be between 1 and 120 characters.';
  END IF;

  INSERT INTO kindred_introductions (user_id, hello, looking_for, updated_at)
  VALUES (v_user_id, v_hello, v_looking_for, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    hello = EXCLUDED.hello,
    looking_for = EXCLUDED.looking_for,
    is_visible = TRUE,
    updated_at = NOW();
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_kindred_prompt()
RETURNS TABLE(id UUID, prompt_text TEXT, response_count BIGINT) AS $$
  SELECT p.id, p.prompt_text, COUNT(r.id)::BIGINT
  FROM kindred_prompts p
  LEFT JOIN kindred_prompt_responses r ON r.prompt_id = p.id
  WHERE p.is_active = TRUE
  GROUP BY p.id, p.prompt_text
  ORDER BY md5(p.id::TEXT || CURRENT_DATE::TEXT)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_kindred_prompt_responses(p_prompt_id UUID, p_limit INTEGER DEFAULT 12)
RETURNS TABLE(
  response_id UUID,
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  response_text TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, up.display_name, up.username, up.avatar_url, r.response_text, r.created_at
  FROM kindred_prompt_responses r
  JOIN user_profiles up ON up.user_id = r.user_id
  WHERE r.prompt_id = p_prompt_id AND COALESCE(up.is_suspended, FALSE) = FALSE
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION respond_to_kindred_prompt(p_prompt_id UUID, p_response TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_response TEXT := btrim(COALESCE(p_response, ''));
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM kindred_prompts WHERE id = p_prompt_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'That prompt is no longer active.';
  END IF;
  IF char_length(v_response) < 1 OR char_length(v_response) > 500 THEN
    RAISE EXCEPTION 'A response should be between 1 and 500 characters.';
  END IF;

  INSERT INTO kindred_prompt_responses (prompt_id, user_id, response_text, updated_at)
  VALUES (p_prompt_id, v_user_id, v_response, NOW())
  ON CONFLICT (prompt_id, user_id) DO UPDATE SET
    response_text = EXCLUDED.response_text,
    updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_buddy_quests(p_limit INTEGER DEFAULT 12)
RETURNS TABLE(
  id UUID,
  host_id UUID,
  host_name TEXT,
  host_username TEXT,
  title TEXT,
  description TEXT,
  time_note TEXT,
  participant_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.host_id, COALESCE(up.display_name, up.username), up.username,
         b.title, b.description, b.time_note, COUNT(bp.id)::BIGINT, b.created_at
  FROM buddy_quests b
  JOIN user_profiles up ON up.user_id = b.host_id
  LEFT JOIN buddy_quest_participants bp ON bp.buddy_quest_id = b.id
  WHERE b.status = 'open' AND COALESCE(up.is_suspended, FALSE) = FALSE
  GROUP BY b.id, b.host_id, up.display_name, up.username
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_buddy_quest(p_title TEXT, p_description TEXT, p_time_note TEXT DEFAULT 'No rush — agree on a time together')
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_title TEXT := btrim(COALESCE(p_title, ''));
  v_description TEXT := btrim(COALESCE(p_description, ''));
  v_time_note TEXT := btrim(COALESCE(p_time_note, 'No rush — agree on a time together'));
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF char_length(v_title) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'A buddy quest title should be 3–100 characters.'; END IF;
  IF char_length(v_description) NOT BETWEEN 10 AND 600 THEN RAISE EXCEPTION 'Tell your future buddy a little more about the quest.'; END IF;
  IF char_length(v_time_note) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Keep the time note under 120 characters.'; END IF;

  INSERT INTO buddy_quests (host_id, title, description, time_note)
  VALUES (v_user_id, v_title, v_description, v_time_note)
  RETURNING id INTO v_id;
  INSERT INTO buddy_quest_participants (buddy_quest_id, user_id, role)
  VALUES (v_id, v_user_id, 'host');
  PERFORM log_activity(v_user_id, 'buddy_quest_created', 'buddy_quest', v_id, jsonb_build_object('title', v_title));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION join_buddy_quest(p_buddy_quest_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_host_id UUID;
  v_title TEXT;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT host_id, title INTO v_host_id, v_title FROM buddy_quests
  WHERE id = p_buddy_quest_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That buddy quest is no longer open.'; END IF;
  IF v_host_id = v_user_id THEN RAISE EXCEPTION 'You are already hosting this quest.'; END IF;
  IF EXISTS (SELECT 1 FROM buddy_quest_participants WHERE buddy_quest_id = p_buddy_quest_id AND user_id = v_user_id) THEN RETURN TRUE; END IF;
  SELECT COUNT(*) INTO v_count FROM buddy_quest_participants WHERE buddy_quest_id = p_buddy_quest_id;
  IF v_count >= 2 THEN RAISE EXCEPTION 'This buddy quest already has its two people.'; END IF;

  INSERT INTO buddy_quest_participants (buddy_quest_id, user_id, role) VALUES (p_buddy_quest_id, v_user_id, 'buddy');
  UPDATE buddy_quests SET status = 'completed', updated_at = NOW() WHERE id = p_buddy_quest_id;
  PERFORM create_notification(v_host_id, 'buddy_quest_joined', 'A kindred buddy joined', 'Someone joined your buddy quest: ' || v_title, 'buddy-quests.html');
  PERFORM log_activity(v_user_id, 'buddy_quest_joined', 'buddy_quest', p_buddy_quest_id, jsonb_build_object('title', v_title));
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_welcome_circle(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_welcome_intro(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kindred_prompt() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_kindred_prompt_responses(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_to_kindred_prompt(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_buddy_quests(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_buddy_quest(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_buddy_quest(UUID) TO authenticated;

INSERT INTO kindred_prompts (prompt_text) VALUES
  ('What is one small thing you are learning right now?'),
  ('What kind of kindness would make this week feel lighter?'),
  ('What are you hoping to find in the Guild?'),
  ('What is a project, story, or song you would happily recommend?'),
  ('What small win would you like someone here to celebrate with you?')
ON CONFLICT (prompt_text) DO NOTHING;
