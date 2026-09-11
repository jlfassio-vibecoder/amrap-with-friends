-- Phase 2b: the nudge that makes the room a return loop.
--
-- The feature plan's loop ends "get reminded -> return for another mission",
-- and until now `room_members.reminders_enabled` has existed since the boundary
-- migration with nothing reading it. This is the reader, the same way the
-- public feed was the reader for `activity_visible`.
--
-- The whole design turns on one question: cron runs every minute, so what stops
-- a member being mailed sixty times an hour? The answer is that the claim and
-- the send are separate acts, and the claim is a row.

CREATE TABLE IF NOT EXISTS public.room_mission_reminders (
  mission_id uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_reason text,
  PRIMARY KEY (mission_id, user_id, kind),
  CONSTRAINT room_mission_reminders_kind_check CHECK (kind IN ('24h', '1h'))
);

ALTER TABLE public.room_mission_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_mission_reminders FROM anon, authenticated;

-- The sender's only query is "what is due", which walks missions and lands here
-- to exclude what is already claimed.
CREATE INDEX IF NOT EXISTS room_mission_reminders_mission_idx
  ON public.room_mission_reminders (mission_id);

-- The claim runs every minute and its predicates are always the same three:
-- a room mission, not yet started, starting soon. Without this it scans and
-- sorts the room's whole mission history on each pass, and that history only
-- grows. Partial, so it stays small: finished missions -- eventually almost
-- all of them -- are not in it.
CREATE INDEX IF NOT EXISTS missions_room_waiting_scheduled_idx
  ON public.missions (scheduled_at)
  WHERE room_id IS NOT NULL AND state = 'waiting' AND scheduled_at IS NOT NULL;

COMMENT ON TABLE public.room_mission_reminders IS
  'One row per reminder actually claimed. The primary key is the idempotency '
  'guarantee: a reminder is claimed exactly once no matter how often the '
  'scheduler runs or how many senders race.';

COMMENT ON COLUMN public.room_mission_reminders.sent_at IS
  'Null means claimed but not yet confirmed sent. A crash between claim and '
  'send therefore drops a reminder rather than repeating one -- the correct '
  'direction to fail for email, where a duplicate is worse than a miss.';


-- Claim what is due, atomically.
--
-- `INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING` is the whole
-- mechanism: the rows that come back are exactly the rows this call won, so two
-- senders racing cannot both mail the same person, and a re-run a minute later
-- returns nothing.
--
-- The windows are open-ended -- "within 24 hours" rather than "between 23h55
-- and 24h05" -- because the ledger already guarantees once. A narrow window has
-- to be right or the reminder is lost forever; an open one only has to be
-- crossed. A member who joins the room late still gets whatever is still true.
--
-- Service role only. No grant to anon or authenticated: this reads email
-- addresses.
CREATE OR REPLACE FUNCTION public.claim_due_room_reminders(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
BEGIN
  WITH due AS (
    SELECT
      m.id AS mission_id,
      rm.user_id,
      CASE WHEN m.scheduled_at <= now() + interval '1 hour' THEN '1h' ELSE '24h' END AS kind
    FROM public.missions m
    JOIN public.rooms r ON r.id = m.room_id
    JOIN public.room_members rm ON rm.room_id = r.id
    JOIN auth.users u ON u.id = rm.user_id
    WHERE m.room_id IS NOT NULL
      -- Never claim a member we cannot mail. Claiming first and filtering the
      -- address later would burn the row permanently on someone who never got
      -- anything.
      AND u.email IS NOT NULL
      AND m.scheduled_at IS NOT NULL
      -- Not started and not over. A mission already running does not need a
      -- reminder, and one that finished must never produce one.
      AND m.state = 'waiting'
      AND m.scheduled_at > now()
      AND m.scheduled_at <= now() + interval '24 hours'
      AND rm.left_at IS NULL
      AND rm.reminders_enabled
      -- A lapsed room goes read-only, and that includes going quiet.
      AND public.room_is_active(r.id)
      -- Exclude what is already claimed *before* the limit, not via ON CONFLICT
      -- after it. Otherwise a busy room's already-sent 24h rows fill the batch
      -- every minute and its 1h reminders never get a turn -- the starvation is
      -- silent, and the symptom is the mail that mattered most going missing.
      -- ON CONFLICT below stays as the guard against two senders racing.
      AND NOT EXISTS (
        SELECT 1 FROM public.room_mission_reminders x
        WHERE x.mission_id = m.id
          AND x.user_id = rm.user_id
          AND x.kind = CASE WHEN m.scheduled_at <= now() + interval '1 hour' THEN '1h' ELSE '24h' END
      )
    -- Soonest first, so the 1h reminders win the batch when one is contended.
    ORDER BY m.scheduled_at
    LIMIT v_limit
  )
  , claimed AS (
    INSERT INTO public.room_mission_reminders (mission_id, user_id, kind)
    SELECT mission_id, user_id, kind FROM due
    ON CONFLICT (mission_id, user_id, kind) DO NOTHING
    RETURNING mission_id, user_id, kind
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'mission_id', c.mission_id,
      'user_id', c.user_id,
      'kind', c.kind,
      'email', u.email,
      'scheduled_at', m.scheduled_at,
      'duration_minutes', m.duration_minutes,
      -- The template id, not the workout jsonb: `missions.workout` is an array
      -- of movements and carries no name, so the only source of a library
      -- workout's name is the template it came from.
      'template_id', m.template_id,
      'room_id', r.id,
      'room_handle', r.handle,
      'room_name', r.display_name,
      'room_timezone', r.timezone
    )
  ), '[]'::jsonb)
  INTO v_rows
  FROM claimed c
  JOIN public.missions m ON m.id = c.mission_id
  JOIN public.rooms r ON r.id = m.room_id
  JOIN auth.users u ON u.id = c.user_id;

  RETURN jsonb_build_object('ok', true, 'reminders', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_room_reminders(int) FROM PUBLIC, anon, authenticated;
-- Granted explicitly rather than relying on Supabase's default privileges: the
-- sender calls this with the service-role JWT, and a missing grant fails as a
-- permission error before a single reminder is claimed -- silently, because
-- nothing sends and nothing is written down.
GRANT EXECUTE ON FUNCTION public.claim_due_room_reminders(int) TO service_role;


-- Confirm a batch. The sender reports back what Resend accepted and what it
-- refused, so a claimed-but-unsent row is visible rather than merely absent.
CREATE OR REPLACE FUNCTION public.settle_room_reminders(p_results jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_results');
  END IF;

  WITH input AS (
    SELECT
      (e ->> 'mission_id')::uuid AS mission_id,
      (e ->> 'user_id')::uuid AS user_id,
      e ->> 'kind' AS kind,
      e ->> 'failed_reason' AS failed_reason
    FROM jsonb_array_elements(p_results) e
  )
  UPDATE public.room_mission_reminders t
  SET
    sent_at = CASE WHEN i.failed_reason IS NULL THEN now() ELSE NULL END,
    failed_reason = i.failed_reason
  FROM input i
  WHERE t.mission_id = i.mission_id
    AND t.user_id = i.user_id
    AND t.kind = i.kind;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'settled', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_room_reminders(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_room_reminders(jsonb) TO service_role;


-- The member's own switch, mirroring set_room_activity_visible exactly.
CREATE OR REPLACE FUNCTION public.set_room_reminders_enabled(
  p_room_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  UPDATE public.room_members
  SET reminders_enabled = coalesce(p_enabled, true)
  WHERE room_id = p_room_id
    AND user_id = v_uid
    AND left_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_member');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reminders_enabled', coalesce(p_enabled, true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_room_reminders_enabled(uuid, boolean) TO authenticated;


-- Per-minute, matching run_featured_wod_scheduler. The job only wakes the
-- sender; all the deciding happens in claim_due_room_reminders.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  END IF;
END;
$$;


-- The unsubscribe path's write.
--
-- Separate from set_room_reminders_enabled because that one derives the member
-- from auth.uid(), and the whole point of an unsubscribe link is that there is
-- no session. Authority comes from the HMAC the route verified before calling
-- this; service role only, never granted to anon.
CREATE OR REPLACE FUNCTION public.admin_set_room_reminders(
  p_user_id uuid,
  p_room_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_user_id IS NULL OR p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  UPDATE public.room_members
  SET reminders_enabled = coalesce(p_enabled, false)
  WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND left_at IS NULL;

  -- Idempotent on purpose: unsubscribing twice, or after leaving the room, is
  -- a success from the reader's point of view. They asked for no more mail and
  -- there will be none.
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_room_reminders(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
-- Without this every valid unsubscribe link fails, which is the worst place in
-- the feature to have a silent permission error.
GRANT EXECUTE ON FUNCTION public.admin_set_room_reminders(uuid, uuid, boolean) TO service_role;
