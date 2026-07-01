-- =========================================================================
-- KINDRED GUILD — PG_CRON SCHEDULED TASKS SETUP
-- Run this AFTER installing pg_cron extension in Supabase
-- =========================================================================

-- First, enable the pg_cron extension (run this once in Supabase dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify extension is installed
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- =========================================================================
-- SCHEDULE 1: Auto-approve quests every hour
-- Checks for submitted quests past their 48-hour appraisal deadline
-- =========================================================================
SELECT cron.schedule(
  'auto-approve-quests-hourly',
  '0 * * * *',  -- At minute 0 of every hour
  $$ SELECT public.auto_approve_quests(); $$
);

-- =========================================================================
-- SCHEDULE 2: Auto-reveal ratings daily at 00:15
-- Reveals ratings older than 7 days and recalculates reputation
-- =========================================================================
SELECT cron.schedule(
  'reveal-ratings-daily',
  '15 0 * * *',  -- At 00:15 every day
  $$ SELECT public.reveal_ratings_and_update_reputation(); $$
);

-- =========================================================================
-- VERIFICATION QUERIES
-- =========================================================================

-- View all scheduled jobs
-- SELECT * FROM cron.job;

-- View job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- =========================================================================
-- MANAGEMENT COMMANDS (if needed)
-- =========================================================================

-- To unschedule a job:
-- SELECT cron.unschedule('auto-approve-quests-hourly');
-- SELECT cron.unschedule('reveal-ratings-daily');

-- To reschedule after changes:
-- Run the schedule commands above again

-- =========================================================================
-- IMPORTANT NOTES
-- =========================================================================
-- 1. pg_cron must be enabled in your Supabase project first
-- 2. Go to Supabase Dashboard > Database > Extensions > Enable pg_cron
-- 3. These schedules run on UTC time
-- 4. Jobs are tied to your database ID - they persist across sessions
-- 5. Monitor job runs in Supabase SQL Editor with the verification queries
