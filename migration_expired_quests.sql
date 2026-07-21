-- =========================================================================
-- KINDRED GUILD — EXPIRED QUESTS HANDLING
-- Auto-closes quests past deadline, refunds locked coins, notifies poster.
-- Run AFTER previous migrations.
-- =========================================================================

-- Add 'expired' to the status constraint if not already there
DO $$
BEGIN
  -- Drop old constraint
  ALTER TABLE quests DROP CONSTRAINT IF EXISTS chk_status;
  -- Add new constraint with 'expired' included
  ALTER TABLE quests ADD CONSTRAINT chk_status 
    CHECK (status IN ('open', 'accepted', 'submitted', 'approved', 'disputed', 'cancelled', 'expired'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add expired_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'expired_at') THEN
    ALTER TABLE quests ADD COLUMN expired_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Function: auto-close expired open/accepted quests and refund coins
CREATE OR REPLACE FUNCTION auto_expire_quests()
RETURNS TABLE(expired_quest_id UUID, refunded_coins INTEGER) AS $$
DECLARE
  v_quest RECORD;
BEGIN
  FOR v_quest IN
    SELECT q.id, q.poster_id, q.worker_id, q.payment_type, q.coin_amount, q.commission_coins, q.deadline
    FROM quests q
    WHERE q.status IN ('open', 'accepted')
      AND q.deadline < NOW()
      AND q.is_deleted = FALSE
  LOOP
    -- Mark quest as expired
    UPDATE quests 
    SET status = 'expired', expired_at = NOW()
    WHERE id = v_quest.id;

    -- Refund locked coins to poster
    IF v_quest.payment_type = 'coins' AND COALESCE(v_quest.coin_amount, 0) > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.coin_amount, 'expired_reward_refund', v_quest.id, NOW());
      refunded_coins := v_quest.coin_amount;
    ELSE
      refunded_coins := 0;
    END IF;

    -- Refund commission too
    IF COALESCE(v_quest.commission_coins, 0) > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.commission_coins, 'expired_commission_refund', v_quest.id, NOW());
      refunded_coins := refunded_coins + v_quest.commission_coins;
    END IF;

    -- Notify the poster
    INSERT INTO notifications (user_id, type, title, message, link, created_at)
    VALUES (
      v_quest.poster_id,
      'quest_expired',
      'Quest Expired',
      'Your quest has expired and any locked coins have been refunded. You can re-post if you still need help.',
      'quest-detail.html?id=' || v_quest.id,
      NOW()
    );

    -- If worker was assigned, notify them too
    IF v_quest.worker_id IS NOT NULL AND v_quest.status = 'accepted' THEN
      INSERT INTO notifications (user_id, type, title, message, link, created_at)
      VALUES (
        v_quest.worker_id,
        'quest_expired',
        'Quest Expired',
        'A quest you were working on has expired due to deadline. No worries — you can find other quests on the board.',
        'quest-board.html',
        NOW()
      );
    END IF;

    expired_quest_id := v_quest.id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: allow poster to re-post an expired quest
CREATE OR REPLACE FUNCTION repost_expired_quest(p_quest_id UUID)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
  v_new_quest_id UUID;
  v_commission INTEGER;
  v_required_coins INTEGER;
  v_balance INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found.';
  END IF;

  IF v_quest.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the quest poster can re-post it.';
  END IF;

  IF v_quest.status != 'expired' THEN
    RAISE EXCEPTION 'Only expired quests can be re-posted.';
  END IF;

  -- Calculate commission for re-posting
  IF v_quest.payment_type = 'coins' THEN
    v_commission := CEIL(COALESCE(v_quest.coin_amount, 0) * 0.1)::INTEGER;
    v_required_coins := v_quest.coin_amount + v_commission;
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < v_required_coins THEN
      RAISE EXCEPTION 'Not enough coins to re-post. Need % FC, have % FC.', v_required_coins, v_balance;
    END IF;
  ELSIF v_quest.payment_type = 'upi' THEN
    v_commission := CEIL(COALESCE(v_quest.upi_amount, 0) * 0.1)::INTEGER;
    v_balance := get_coin_balance(v_user_id);
    IF v_balance < v_commission THEN
      RAISE EXCEPTION 'Not enough coins for commission. Need % FC, have % FC.', v_commission, v_balance;
    END IF;
  ELSE
    v_commission := 0;
  END IF;

  -- Create new quest based on the expired one
  INSERT INTO quests (poster_id, title, description, payment_type, coin_amount, upi_amount, commission_coins, status, deadline, created_at)
  VALUES (
    v_user_id, v_quest.title, v_quest.description, v_quest.payment_type,
    CASE WHEN v_quest.payment_type = 'coins' THEN v_quest.coin_amount ELSE NULL END,
    CASE WHEN v_quest.payment_type = 'upi' THEN v_quest.upi_amount ELSE NULL END,
    CASE WHEN v_quest.payment_type IN ('coins','upi') THEN v_commission ELSE NULL END,
    'open', NOW() + INTERVAL '7 days', NOW()
  ) RETURNING id INTO v_new_quest_id;

  -- Lock coins/commission for new quest
  IF v_quest.payment_type = 'coins' THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -v_commission, 'commission_locked', v_new_quest_id, NOW());
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -v_quest.coin_amount, 'reward_locked', v_new_quest_id, NOW());
  ELSIF v_quest.payment_type = 'upi' THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, -v_commission, 'commission_locked', v_new_quest_id, NOW());
  END IF;

  RETURN v_new_quest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure notifications table exists (it should from earlier migrations)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM notifications WHERE user_id = auth.uid() AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;

-- Index for fast expiry lookups
CREATE INDEX IF NOT EXISTS idx_quests_status_deadline ON quests(status, deadline) WHERE status IN ('open', 'accepted') AND is_deleted = FALSE;
