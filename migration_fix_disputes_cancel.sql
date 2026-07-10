-- =========================================================================
-- KINDRED GUILD — FIX: Dispute resolution, quest cancellation
-- Date: 2026-07-10
-- =========================================================================

-- =========================================================================
-- 1. Fix resolve_dispute_jointly to accept text action parameter
-- =========================================================================

DROP FUNCTION IF EXISTS resolve_dispute_jointly(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION resolve_dispute_jointly(p_quest_id UUID, p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
  v_release BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found.';
  END IF;

  IF v_quest.poster_id != v_user_id AND v_quest.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Only quest participants can resolve disputes.';
  END IF;

  IF v_quest.status != 'disputed' THEN
    RAISE EXCEPTION 'Only disputed quests can be resolved.';
  END IF;

  IF p_action NOT IN ('release', 'refund') THEN
    RAISE EXCEPTION 'Invalid action. Use "release" or "refund".';
  END IF;

  v_release := (p_action = 'release');

  -- Update quest status
  UPDATE quests SET status = 'approved', appraisal_deadline = NULL WHERE id = p_quest_id;

  IF v_release THEN
    -- Release reward to worker
    IF v_quest.payment_type = 'coins' AND COALESCE(v_quest.coin_amount, 0) > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.worker_id, v_quest.coin_amount, 'quest_earning', p_quest_id, NOW());
    END IF;
  ELSE
    -- Refund poster
    IF v_quest.payment_type = 'coins' AND COALESCE(v_quest.coin_amount, 0) > 0 THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.coin_amount, 'reward_locked_refund', p_quest_id, NOW());
    END IF;
  END IF;

  -- Always refund commission since dispute means incomplete service
  IF v_quest.commission_coins > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_quest.poster_id, v_quest.commission_coins, 'commission_locked_refund', p_quest_id, NOW());
  END IF;

  -- Log activity
  PERFORM log_activity(v_user_id, 'dispute_resolved', 'quest', p_quest_id,
    jsonb_build_object('title', v_quest.title, 'action', p_action));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 2. Quest cancellation function (poster can cancel open/accepted quests)
-- =========================================================================

CREATE OR REPLACE FUNCTION cancel_quest(p_quest_id UUID)
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

  IF v_quest.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the quest poster can cancel this quest.';
  END IF;

  -- Can cancel open quests (no worker yet) or accepted quests (worker assigned but work not submitted)
  IF v_quest.status NOT IN ('open', 'accepted') THEN
    RAISE EXCEPTION 'Can only cancel open or accepted quests. For submitted quests, request revision or file a dispute.';
  END IF;

  -- Update quest status
  UPDATE quests SET status = 'cancelled', worker_id = NULL WHERE id = p_quest_id;

  -- Refund locked coins
  IF v_quest.payment_type = 'coins' AND COALESCE(v_quest.coin_amount, 0) > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, v_quest.coin_amount, 'quest_cancelled_refund', p_quest_id, NOW());
  END IF;

  IF v_quest.commission_coins > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
    VALUES (v_user_id, v_quest.commission_coins, 'commission_cancelled_refund', p_quest_id, NOW());
  END IF;

  -- Notify worker if one was assigned
  IF v_quest.worker_id IS NOT NULL THEN
    PERFORM create_notification(v_quest.worker_id, 'quest_cancelled',
      'Quest Cancelled', 'The quest "' || v_quest.title || '" has been cancelled by the poster.',
      'quest-detail.html?id=' || p_quest_id);
  END IF;

  -- Log activity
  PERFORM log_activity(v_user_id, 'quest_cancelled', 'quest', p_quest_id,
    jsonb_build_object('title', v_quest.title));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 3. Add quest_accepted activity logging (trigger already fires notification)
-- =========================================================================

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
