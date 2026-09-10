-- Carry `route` through heartbeat compaction. Copilot review on PR #116.
--
-- 20260909340000 wrote the replacement row without a route, so every
-- compacted heartbeat landed with route NULL. coach_anon_summary reads
-- lastRoute off the single most recent event in 90 days, and for a guest idle
-- more than 48 hours that row is now the compacted one -- so lastRoute went
-- blank, and Explore's route column with it.
--
-- This is a separate migration rather than an edit to 20260909340000 because
-- that version is already recorded in the remote migration history: editing
-- the applied file changes what the repo *says* ran without changing what
-- actually ran, and `db push` would never replay it. A migration is a dated
-- record, not a description of the current schema.
--
-- Note what this cannot repair. The compaction DELETEs the rows it replaces,
-- so routes already dropped by an earlier run are gone. This stops the loss
-- from here forward; it does not recover it.
--
-- mission_id and participant_id stay null by design: they are structurally
-- null for heartbeats, since useGlobalPresenceBroadcast passes only
-- { userId } as track() context.

CREATE OR REPLACE FUNCTION public.compact_presence_heartbeats(
  p_compact_after interval DEFAULT interval '48 hours',
  p_delete_after interval DEFAULT interval '400 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_compacted bigint := 0;
  v_kept bigint := 0;
  v_deleted bigint := 0;
BEGIN
  DELETE FROM public.analytics_events
  WHERE event_name = 'presence_heartbeat'
    AND occurred_at < now() - p_delete_after;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  WITH deleted AS (
    DELETE FROM public.analytics_events
    WHERE event_name = 'presence_heartbeat'
      AND occurred_at < now() - p_compact_after
      AND coalesce((props ->> 'compacted')::boolean, false) IS NOT TRUE
    RETURNING user_id, anon_id, occurred_at, route
  ),
  inserted AS (
    INSERT INTO public.analytics_events
      (event_name, occurred_at, user_id, anon_id, route, props)
    SELECT
      'presence_heartbeat',
      max(d.occurred_at),
      d.user_id,
      d.anon_id,
      -- The route of the latest ping in the hour, not an arbitrary one: the
      -- compacted row's occurred_at is that same ping's, so the pair matches
      -- what an uncompacted table would have returned.
      (array_agg(d.route ORDER BY d.occurred_at DESC))[1],
      jsonb_build_object('compacted', true, 'ping_count', count(*))
    FROM deleted d
    GROUP BY d.user_id, d.anon_id, date_trunc('hour', d.occurred_at)
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM deleted),
    (SELECT count(*) FROM inserted)
  INTO v_compacted, v_kept;

  RETURN jsonb_build_object(
    'ok', true,
    'rows_compacted', v_compacted,
    'rows_kept', v_kept,
    'rows_deleted', v_deleted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compact_presence_heartbeats(interval, interval)
  FROM PUBLIC, anon, authenticated;
