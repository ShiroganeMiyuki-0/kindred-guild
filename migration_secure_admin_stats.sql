-- Harden the existing admin dashboard statistics RPC.
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS TABLE(
  total_users BIGINT,
  total_quests BIGINT,
  active_quests BIGINT,
  total_wishes BIGINT,
  pending_purchases BIGINT,
  total_guild_messages BIGINT,
  total_warnings BIGINT
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
    RAISE EXCEPTION 'Only administrators can view dashboard statistics.';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.user_profiles),
    (SELECT COUNT(*) FROM public.quests),
    (SELECT COUNT(*) FROM public.quests WHERE status IN ('open', 'accepted', 'submitted') AND COALESCE(is_deleted, FALSE) = FALSE),
    (SELECT COUNT(*) FROM public.wishes WHERE status = 'active' AND COALESCE(is_deleted, FALSE) = FALSE),
    (SELECT COUNT(*) FROM public.coin_purchases WHERE status = 'pending'),
    (SELECT COUNT(*) FROM public.guild_messages WHERE COALESCE(is_deleted, FALSE) = FALSE),
    (SELECT COUNT(*) FROM public.admin_warnings);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
