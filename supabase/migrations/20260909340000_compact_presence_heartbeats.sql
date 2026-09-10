-- Cap the growth of presence_heartbeat without changing what any metric says.
--
-- useGlobalPresenceBroadcast writes one heartbeat per open tab every 60s,
-- forever, into the same table as product analytics. Nothing pruned it, and
-- every dashboard aggregate scans that table — so the cost curve is driven by
-- tabs left open, not by users.
--
-- The obvious fix, deleting old heartbeats, is wrong here. Only
-- coach_online_now() reads the event by name (last 90 seconds). Several other
-- queries read analytics_events *generically* and treat any event as a sign of
-- life:
--
--   * guestBrowsers7d and coach_guest_browsers_series count DISTINCT anon_id
--     over all events -- and a guest who opens the page and reads it emits
--     heartbeats and little else, so heartbeats are much of that signal.
--   * coach_users_list derives last_active_at from max(occurred_at) over all
--     events, which feeds the activity cohorts.
--
-- Deleting heartbeats would quietly shrink the guest counts and back-date
-- last_active_at. So this compacts instead: heartbeats older than the live
-- window collapse to one row per identity per hour, keeping the latest
-- occurred_at in that hour and recording how many pings it stands for.
--
-- That is exact for every consumer. coach_guest_browsers_series only uses
-- hour grain for its 24h window; 3d/7d/30d/90d/365d are all day grain, and
-- compaction runs no closer than 48h, so no series bucket can change. A
-- DISTINCT identity per bucket is unaffected by how many rows back it. Only
-- last_active_at loses precision, and only for periods over two days old,
-- where it is rendered as a date anyway.

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
  -- Past every reporting window (the longest is 365d), a heartbeat says
  -- nothing that any query can still ask about.
  DELETE FROM public.analytics_events
  WHERE event_name = 'presence_heartbeat'
    AND occurred_at < now() - p_delete_after;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- One statement so the raw rows and their replacement never exist apart:
  -- the DELETE feeds the INSERT, and both roll back together on error.
  WITH deleted AS (
    DELETE FROM public.analytics_events
    WHERE event_name = 'presence_heartbeat'
      AND occurred_at < now() - p_compact_after
      AND coalesce((props ->> 'compacted')::boolean, false) IS NOT TRUE
    RETURNING user_id, anon_id, occurred_at
  ),
  inserted AS (
    INSERT INTO public.analytics_events (event_name, occurred_at, user_id, anon_id, props)
    SELECT
      'presence_heartbeat',
      max(d.occurred_at),
      d.user_id,
      d.anon_id,
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

-- Hourly, not per-minute: the work is proportional to an hour of heartbeats
-- either way, and nothing reads the compacted region with any urgency.
-- cron.schedule() upserts by job name, so replaying this migration is
-- idempotent; the guard lets a local/CI Postgres without pg_cron replay it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    PERFORM cron.schedule(
      'compact-presence-heartbeats',
      '17 * * * *',
      'SELECT public.compact_presence_heartbeats();'
    );
  END IF;
END;
$$;

-- The partial index that makes both the compaction pass and coach_online_now
-- cheap. Without it each run seq-scans a table whose whole problem is size.
CREATE INDEX IF NOT EXISTS analytics_events_presence_occurred_idx
  ON public.analytics_events (occurred_at)
  WHERE event_name = 'presence_heartbeat';
