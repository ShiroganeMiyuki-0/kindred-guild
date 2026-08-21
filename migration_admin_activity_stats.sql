-- Admin-only Guild activity summary for the administrator dashboard.
-- The function checks the caller inside the database and returns no data to
-- anonymous or non-admin users, even if the RPC is called directly.
CREATE OR REPLACE FUNCTION public.get_admin_activity_stats()
RETURNS TABLE(
  member_count BIGINT,
  quest_count BIGINT,
  completed_count BIGINT,
  coins_earned NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_id = v_user_id
      AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only administrators can view Guild activity.';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.user_profiles),
    (SELECT COUNT(*) FROM public.quests WHERE COALESCE(is_deleted, FALSE) = FALSE),
    (SELECT COUNT(*) FROM public.quests WHERE status = 'approved' AND COALESCE(is_deleted, FALSE) = FALSE),
    COALESCE((SELECT SUM(amount) FROM public.fairy_ledger WHERE reason = 'quest_earning'), 0)::NUMERIC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_activity_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_activity_stats() TO authenticated;
