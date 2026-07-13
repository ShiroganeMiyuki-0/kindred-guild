-- =========================================================================
-- KINDRED GUILD — AUTO-REFUND & STALE QUEST CLEANUP
-- Run this in Supabase SQL Editor to add auto-refund rules.
-- =========================================================================

-- 1. Auto-cancel open quests with no accept after 7 days
CREATE OR REPLACE FUNCTION auto_cancel_stale_quests()
RETURNS VOID AS $$
DECLARE
  v_quest RECORD;
BEGIN
  FOR v_quest IN
    SELECT q.id, q.poster_id, q.coin_amount, q.payment_type, q.commission_coins
    FROM quests q
    WHERE q.status = 'open'
      AND q.created_at < NOW() - INTERVAL '7 days'
  LOOP
    -- Cancel the quest
    UPDATE quests SET status = 'cancelled' WHERE id = v_quest.id;

    -- Refund locked coins (reward + commission)
    IF v_quest.payment_type = 'coins' THEN
      -- Refund reward
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.coin_amount, 'refund', v_quest.id, NOW());

      -- Refund commission
      IF v_quest.commission_coins IS NOT NULL AND v_quest.commission_coins > 0 THEN
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_quest.poster_id, v_quest.commission_coins, 'commission_refund', v_quest.id, NOW());
      END IF;
    ELSIF v_quest.payment_type = 'upi' THEN
      -- Refund commission deposit
      IF v_quest.commission_coins IS NOT NULL AND v_quest.commission_coins > 0 THEN
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_quest.poster_id, v_quest.commission_coins, 'commission_refund', v_quest.id, NOW());
      END IF;
    END IF;

    RAISE NOTICE 'Auto-cancelled stale quest % (open > 7 days)', v_quest.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Auto-cancel accepted quests where deadline passed and no proof submitted
CREATE OR REPLACE FUNCTION auto_cancel_expired_accepted()
RETURNS VOID AS $$
DECLARE
  v_quest RECORD;
BEGIN
  FOR v_quest IN
    SELECT q.id, q.poster_id, q.worker_id, q.coin_amount, q.payment_type, q.commission_coins
    FROM quests q
    WHERE q.status = 'accepted'
      AND q.deadline < NOW()
  LOOP
    -- Cancel the quest
    UPDATE quests SET status = 'cancelled' WHERE id = v_quest.id;

    -- Refund poster
    IF v_quest.payment_type = 'coins' THEN
      INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
      VALUES (v_quest.poster_id, v_quest.coin_amount, 'refund', v_quest.id, NOW());

      IF v_quest.commission_coins IS NOT NULL AND v_quest.commission_coins > 0 THEN
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_quest.poster_id, v_quest.commission_coins, 'commission_refund', v_quest.id, NOW());
      END IF;
    ELSIF v_quest.payment_type = 'upi' THEN
      IF v_quest.commission_coins IS NOT NULL AND v_quest.commission_coins > 0 THEN
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_quest.poster_id, v_quest.commission_coins, 'commission_refund', v_quest.id, NOW());
      END IF;
    END IF;

    -- Give worker a strike
    INSERT INTO strikes (user_id, quest_id, reason, resolved)
    VALUES (v_quest.worker_id, v_quest.id, 'Accepted quest but did not submit before deadline', FALSE);

    RAISE NOTICE 'Auto-cancelled expired quest %, strike given to worker %', v_quest.id, v_quest.worker_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Auto-resolve disputes where one side didn't respond in 72 hours
CREATE OR REPLACE FUNCTION auto_resolve_stale_disputes()
RETURNS VOID AS $$
DECLARE
  v_quest RECORD;
  v_last_comment RECORD;
BEGIN
  FOR v_quest IN
    SELECT q.id, q.poster_id, q.worker_id, q.coin_amount, q.payment_type
    FROM quests q
    WHERE q.status = 'disputed'
      AND q.updated_at < NOW() - INTERVAL '72 hours'
  LOOP
    -- Check who commented last in the dispute
    SELECT user_id, created_at INTO v_last_comment
    FROM quest_comments
    WHERE quest_id = v_quest.id
      AND created_at > v_quest.updated_at
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no comments since dispute opened, favor the worker (poster filed but didn't follow up)
    IF v_last_comment IS NULL THEN
      -- Release to worker
      UPDATE quests SET status = 'approved' WHERE id = v_quest.id;
      IF v_quest.payment_type = 'coins' THEN
        INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
        VALUES (v_quest.worker_id, v_quest.coin_amount, 'quest_earning', v_quest.id, NOW());
      END IF;
      RAISE NOTICE 'Auto-resolved dispute % (no activity) -> released to worker', v_quest.id;
    ELSE
      -- Favor the side that DID comment last (they were responsive)
      IF v_last_comment.user_id = v_quest.poster_id THEN
        -- Poster was last to comment -> refund poster
        UPDATE quests SET status = 'cancelled' WHERE id = v_quest.id;
        IF v_quest.payment_type = 'coins' THEN
          INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
          VALUES (v_quest.poster_id, v_quest.coin_amount, 'refund', v_quest.id, NOW());
        END IF;
        RAISE NOTICE 'Auto-resolved dispute % -> refunded to poster (worker unresponsive)', v_quest.id;
      ELSE
        -- Worker was last to comment -> release to worker
        UPDATE quests SET status = 'approved' WHERE id = v_quest.id;
        IF v_quest.payment_type = 'coins' THEN
          INSERT INTO fairy_ledger (user_id, amount, reason, quest_id, created_at)
          VALUES (v_quest.worker_id, v_quest.coin_amount, 'quest_earning', v_quest.id, NOW());
        END IF;
        RAISE NOTICE 'Auto-resolved dispute % -> released to worker (poster unresponsive)', v_quest.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- SCHEDULE THESE WITH PG_CRON
-- Run after enabling pg_cron extension:
-- =========================================================================

-- Check for stale open quests every 6 hours
SELECT cron.schedule(
  'auto-cancel-stale-quests',
  '0 */6 * * *',
  $$ SELECT public.auto_cancel_stale_quests(); $$
);

-- Check for expired accepted quests every hour
SELECT cron.schedule(
  'auto-cancel-expired-accepted',
  '30 * * * *',
  $$ SELECT public.auto_cancel_expired_accepted(); $$
);

-- Check for stale disputes every 6 hours
SELECT cron.schedule(
  'auto-resolve-stale-disputes',
  '15 */6 * * *',
  $$ SELECT public.auto_resolve_stale_disputes(); $$
);

-- =========================================================================
-- NOTES:
-- 1. Run this AFTER the main schema (supabase_sql_schema.sql)
-- 2. The strikes table must exist (it does in your schema)
-- 3. pg_cron must be enabled: Supabase Dashboard > Database > Extensions
-- 4. Monitor with: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- =========================================================================
