-- The welcome a host never got.
--
-- Creating a room is the moment a coach has just committed to something and
-- has no idea what to do next, and until now it sent nothing at all. The room
-- exists, the dashboard is there, and the host is left to discover both.
--
-- `create_room` cannot send it. It is a Postgres function and this database has
-- no pg_net, so the mail has to be sent from outside and something has to
-- remember whether it went. That "something" is the same shape as the reminder
-- ledger, deliberately: a claim, a send, a settle.
--
-- A sweep rather than a call from the client after create_room succeeds. The
-- client version is less code and loses the welcome whenever a tab closes or a
-- network blips -- silently, with the host never learning what they missed,
-- which is exactly the failure this feature exists to fix. A sweep also picks
-- up rooms created before it shipped, which is the difference between fixing
-- this for the next host and fixing it for the one who already hit it.

CREATE TABLE IF NOT EXISTS public.room_welcome_emails (
  room_id uuid PRIMARY KEY REFERENCES public.rooms (id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_reason text
);

ALTER TABLE public.room_welcome_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_welcome_emails FROM anon, authenticated;

COMMENT ON TABLE public.room_welcome_emails IS
  'One row per room, claimed before the welcome is sent. The primary key is '
  'the guarantee a host is welcomed exactly once, however often the sweep runs.';


-- Claim the rooms that have never been welcomed.
--
-- Same mechanism as claim_due_room_reminders and for the same reason: the rows
-- returned are the rows this call won, so two sweeps racing cannot both mail
-- the same host, and a crash between claim and send drops a welcome rather
-- than repeating one.
--
-- Deliberately not filtered on room_is_active. A host whose room has no
-- entitlement yet is precisely the host most in need of being told what
-- happens next, and `is_active` is returned so the mail can say which
-- situation they are in.
CREATE OR REPLACE FUNCTION public.claim_room_welcomes(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
BEGIN
  WITH due AS (
    SELECT r.id AS room_id
    FROM public.rooms r
    JOIN public.host_accounts h ON h.id = r.host_account_id
    JOIN auth.users u ON u.id = h.owner_user_id
    WHERE u.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.room_welcome_emails w WHERE w.room_id = r.id
      )
    ORDER BY r.created_at
    LIMIT v_limit
  )
  , claimed AS (
    INSERT INTO public.room_welcome_emails (room_id)
    SELECT room_id FROM due
    ON CONFLICT (room_id) DO NOTHING
    RETURNING room_id
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'room_id', r.id,
      'handle', r.handle,
      'display_name', r.display_name,
      'timezone', r.timezone,
      'is_active', public.room_is_active(r.id),
      'owner_user_id', h.owner_user_id,
      'email', u.email
    )
  ), '[]'::jsonb)
  INTO v_rows
  FROM claimed c
  JOIN public.rooms r ON r.id = c.room_id
  JOIN public.host_accounts h ON h.id = r.host_account_id
  JOIN auth.users u ON u.id = h.owner_user_id;

  RETURN jsonb_build_object('ok', true, 'welcomes', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_room_welcomes(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_room_welcomes(int) TO service_role;


CREATE OR REPLACE FUNCTION public.settle_room_welcomes(p_results jsonb)
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
      (e ->> 'room_id')::uuid AS room_id,
      e ->> 'failed_reason' AS failed_reason
    FROM jsonb_array_elements(p_results) e
  )
  UPDATE public.room_welcome_emails t
  SET
    sent_at = CASE WHEN i.failed_reason IS NULL THEN now() ELSE NULL END,
    failed_reason = i.failed_reason
  FROM input i
  WHERE t.room_id = i.room_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'settled', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_room_welcomes(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_room_welcomes(jsonb) TO service_role;
