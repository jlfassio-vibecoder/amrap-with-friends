-- A host can put a workout on a squad friend's My sessions page.
--
-- my_sessions() has only ever answered "what did I train?" -- it joins
-- participants.user_id to sessions, so a row exists because someone showed up.
-- This adds the other half: something waiting to be trained. Deliberately a
-- separate table rather than a sessions row, because a sessions row is a real
-- thing with a host token, a lobby seat and a scoring lifecycle, and none of
-- that exists until the athlete decides to start. Nothing here touches anyone's
-- training history: a prescription becomes history only by being run, through
-- the ordinary create_session path.
--
-- Reach is squad friends. squad_friends stores both directions of an accepted
-- friendship (squad_become_friends inserts the pair), so one EXISTS settles it,
-- and a friendship is already mutually consented -- which is why an assignment
-- can land directly and be dismissed rather than needing its own accept step.

CREATE TABLE IF NOT EXISTS public.assigned_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  duration_minutes int NOT NULL,
  workout jsonb NOT NULL,
  template_id text,
  intensity_tier int,
  note text,
  -- 'pending' until the athlete acts. Kept as a row afterwards rather than
  -- deleted so a dismissal sticks and the same workout cannot be re-sent into
  -- the same slot again and again.
  status text NOT NULL DEFAULT 'pending',
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT assigned_workouts_not_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT assigned_workouts_duration_range CHECK (duration_minutes BETWEEN 1 AND 60),
  CONSTRAINT assigned_workouts_intensity_range CHECK (
    intensity_tier IS NULL OR intensity_tier BETWEEN 1 AND 5
  ),
  CONSTRAINT assigned_workouts_note_length CHECK (note IS NULL OR length(note) <= 200),
  CONSTRAINT assigned_workouts_status_allowed CHECK (
    status IN ('pending', 'started', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_assigned_workouts_to_user
  ON public.assigned_workouts (to_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_from_user
  ON public.assigned_workouts (from_user_id, created_at DESC);

ALTER TABLE public.assigned_workouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assigned_workouts FROM PUBLIC, anon, authenticated;

-- How many unactioned workouts one person may be holding from one sender. A
-- squad friend is not a stranger, but "already consented to be friends" is not
-- consent to an unbounded queue.
CREATE OR REPLACE FUNCTION public.assigned_workout_pending_limit()
RETURNS int LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 5 $$;

CREATE OR REPLACE FUNCTION public.assign_workout(
  p_to_user_id uuid,
  p_duration_minutes int,
  p_workout jsonb,
  p_template_id text DEFAULT NULL,
  p_intensity_tier int DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_template_id text;
  v_note text;
  v_pending int;
  v_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  IF p_to_user_id IS NULL OR p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Pick a squad friend to send it to';
  END IF;

  -- Both directions are stored, so this is the whole authorisation check.
  -- Same error whether they are not a friend or do not exist, so this cannot be
  -- used to probe which accounts are real.
  IF NOT EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = v_uid AND friend_user_id = p_to_user_id
  ) THEN
    RAISE EXCEPTION 'Pick a squad friend to send it to';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  v_template_id := nullif(btrim(coalesce(p_template_id, '')), '');
  IF v_template_id IS NOT NULL AND length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_intensity_tier IS NOT NULL AND (p_intensity_tier < 1 OR p_intensity_tier > 5) THEN
    RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
  END IF;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 200 THEN
    RAISE EXCEPTION 'Keep the note to 200 characters or fewer';
  END IF;

  SELECT count(*)::int INTO v_pending
  FROM public.assigned_workouts
  WHERE to_user_id = p_to_user_id
    AND from_user_id = v_uid
    AND status = 'pending';

  IF v_pending >= public.assigned_workout_pending_limit() THEN
    RAISE EXCEPTION 'They have not picked up your last few workouts yet';
  END IF;

  INSERT INTO public.assigned_workouts
    (from_user_id, to_user_id, duration_minutes, workout, template_id, intensity_tier, note)
  VALUES
    (v_uid, p_to_user_id, p_duration_minutes, p_workout, v_template_id, p_intensity_tier, v_note)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'assigned_workout_id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  TO authenticated;

-- What the recipient sees on My sessions. Sender nickname included so the row
-- can say who it is from -- an unattributed workout is just clutter.
CREATE OR REPLACE FUNCTION public.my_assigned_workouts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assigned_workout_id', a.id,
        'from_user_id', a.from_user_id,
        'from_nickname', coalesce(p.nickname, p.username),
        'duration_minutes', a.duration_minutes,
        'workout', a.workout,
        'template_id', a.template_id,
        'intensity_tier', a.intensity_tier,
        'note', a.note,
        'created_at', a.created_at
      )
      ORDER BY a.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.assigned_workouts a
  LEFT JOIN public.athlete_profiles p ON p.user_id = a.from_user_id
  WHERE a.to_user_id = v_uid
    AND a.status = 'pending';

  RETURN jsonb_build_object('ok', true, 'assigned_workouts', v_rows);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_assigned_workouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_assigned_workouts() TO authenticated;

-- Recipient only: the sender cannot withdraw one they have already sent, the
-- same way you cannot unsay something.
CREATE OR REPLACE FUNCTION public.dismiss_assigned_workout(p_assigned_workout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.assigned_workouts
  SET status = 'dismissed', resolved_at = now()
  WHERE id = p_assigned_workout_id
    AND to_user_id = v_uid
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Same answer for "not yours" and "no such row", so this cannot be used to
  -- probe which assignment ids exist.
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'That workout is not available';
  END IF;

  RETURN jsonb_build_object('ok', true, 'assigned_workout_id', p_assigned_workout_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dismiss_assigned_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_assigned_workout(uuid) TO authenticated;

-- Marks one as started once the athlete has created the session from it, so it
-- leaves the list and carries a link to what they actually ran.
CREATE OR REPLACE FUNCTION public.start_assigned_workout(
  p_assigned_workout_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- The session has to be one the caller is actually in, so an assignment
  -- cannot be marked started against someone else's session.
  IF NOT EXISTS (
    SELECT 1 FROM public.participants
    WHERE session_id = p_session_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'That workout is not available';
  END IF;

  UPDATE public.assigned_workouts
  SET status = 'started', session_id = p_session_id, resolved_at = now()
  WHERE id = p_assigned_workout_id
    AND to_user_id = v_uid
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'That workout is not available';
  END IF;

  RETURN jsonb_build_object('ok', true, 'assigned_workout_id', p_assigned_workout_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_assigned_workout(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_assigned_workout(uuid, uuid) TO authenticated;
