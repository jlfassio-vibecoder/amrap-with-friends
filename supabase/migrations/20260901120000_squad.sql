-- In-app squad: request + accept friends, plus a personal invite code so
-- someone without an account can land in a pending invite after they sign up.
-- Not email. Session rally links stay the way you bring someone into a workout.

CREATE TABLE IF NOT EXISTS public.squad_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  invite_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS squad_invite_codes_code_uidx
  ON public.squad_invite_codes (invite_code);

CREATE TABLE IF NOT EXISTS public.squad_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT squad_requests_not_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT squad_requests_status_allowed CHECK (
    status IN ('pending', 'accepted', 'declined', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS squad_requests_pending_pair_uidx
  ON public.squad_requests (
    LEAST(from_user_id, to_user_id),
    GREATEST(from_user_id, to_user_id)
  )
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_squad_requests_to_pending
  ON public.squad_requests (to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_squad_requests_from_pending
  ON public.squad_requests (from_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.squad_friends (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id),
  CONSTRAINT squad_friends_not_self CHECK (user_id <> friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_friends_friend_user_id
  ON public.squad_friends (friend_user_id);

ALTER TABLE public.squad_invite_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_invite_codes FROM PUBLIC, anon, authenticated;
ALTER TABLE public.squad_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.squad_friends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_friends FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.squad_friend_limit()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 50 $$;

CREATE OR REPLACE FUNCTION public.squad_ensure_invite_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  SELECT invite_code INTO v_code
  FROM public.squad_invite_codes
  WHERE user_id = p_user_id;

  IF FOUND THEN
    RETURN v_code;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
    BEGIN
      INSERT INTO public.squad_invite_codes (user_id, invite_code)
      VALUES (p_user_id, v_code);
      RETURN v_code;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT invite_code INTO v_code
        FROM public.squad_invite_codes
        WHERE user_id = p_user_id;
        IF FOUND THEN
          RETURN v_code;
        END IF;
        IF v_attempt >= 5 THEN
          RAISE EXCEPTION 'Could not allocate an invite code, please try again';
        END IF;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.squad_ensure_invite_code(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.squad_become_friends(p_a uuid, p_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  INSERT INTO public.squad_friends (user_id, friend_user_id)
  VALUES (p_a, p_b)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.squad_friends (user_id, friend_user_id)
  VALUES (p_b, p_a)
  ON CONFLICT DO NOTHING;

  UPDATE public.squad_requests
  SET status = 'accepted', updated_at = now()
  WHERE status = 'pending'
    AND (
      (from_user_id = p_a AND to_user_id = p_b)
      OR (from_user_id = p_b AND to_user_id = p_a)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.squad_become_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.squad_athlete_json(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'nickname', p.nickname
  )
  FROM public.athlete_profiles p
  WHERE p.user_id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.squad_athlete_json(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_squad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_code text;
  v_friends jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_code := public.squad_ensure_invite_code(v_uid);

  SELECT coalesce(
    jsonb_agg(
      public.squad_athlete_json(f.friend_user_id)
      ORDER BY coalesce(
        (SELECT nickname FROM public.athlete_profiles WHERE user_id = f.friend_user_id),
        ''
      )
    ),
    '[]'::jsonb
  )
  INTO v_friends
  FROM public.squad_friends f
  WHERE f.user_id = v_uid
    AND EXISTS (SELECT 1 FROM public.athlete_profiles p WHERE p.user_id = f.friend_user_id);

  SELECT coalesce(
    jsonb_agg(
      public.squad_athlete_json(r.from_user_id)
      || jsonb_build_object('request_id', r.id)
      ORDER BY r.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_incoming
  FROM public.squad_requests r
  WHERE r.to_user_id = v_uid AND r.status = 'pending';

  SELECT coalesce(
    jsonb_agg(
      public.squad_athlete_json(r.to_user_id)
      || jsonb_build_object('request_id', r.id)
      ORDER BY r.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_outgoing
  FROM public.squad_requests r
  WHERE r.from_user_id = v_uid AND r.status = 'pending';

  RETURN jsonb_build_object(
    'ok', true,
    'invite_code', v_code,
    'friends', v_friends,
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'friend_limit', public.squad_friend_limit()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_squad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_squad() TO authenticated;

CREATE OR REPLACE FUNCTION public.search_athletes(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_like text;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_q := btrim(coalesce(p_query, ''));
  IF char_length(v_q) < 3 THEN
    RETURN jsonb_build_object('ok', true, 'athletes', '[]'::jsonb);
  END IF;

  v_like := '%' || replace(replace(v_q, '\', '\\'), '%', '\%') || '%';
  v_like := replace(v_like, '_', '\_');

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', hit.user_id,
        'username', hit.username,
        'nickname', hit.nickname,
        'status', hit.status
      )
      ORDER BY hit.username ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      p.user_id,
      p.username,
      p.nickname,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.squad_friends f
          WHERE f.user_id = v_uid AND f.friend_user_id = p.user_id
        ) THEN 'friends'
        WHEN EXISTS (
          SELECT 1 FROM public.squad_requests r
          WHERE r.from_user_id = v_uid AND r.to_user_id = p.user_id AND r.status = 'pending'
        ) THEN 'pending_out'
        WHEN EXISTS (
          SELECT 1 FROM public.squad_requests r
          WHERE r.from_user_id = p.user_id AND r.to_user_id = v_uid AND r.status = 'pending'
        ) THEN 'pending_in'
        ELSE 'none'
      END AS status
    FROM public.athlete_profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id <> v_uid
      AND (
        p.username ILIKE v_like ESCAPE '\'
        OR (
          position('@' IN v_q) > 0
          AND lower(u.email) = lower(v_q)
        )
      )
    ORDER BY p.username ASC
    LIMIT 10
  ) hit;

  RETURN jsonb_build_object('ok', true, 'athletes', v_rows);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_athletes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_squad_invite(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_existing public.squad_requests%ROWTYPE;
  v_mine int;
  v_theirs int;
  v_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = v_uid AND friend_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Already friends';
  END IF;

  SELECT * INTO v_existing
  FROM public.squad_requests
  WHERE status = 'pending'
    AND (
      (from_user_id = v_uid AND to_user_id = p_user_id)
      OR (from_user_id = p_user_id AND to_user_id = v_uid)
    );

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'request_id', v_existing.id,
      'already_pending', true
    );
  END IF;

  SELECT count(*)::int INTO v_mine FROM public.squad_friends WHERE user_id = v_uid;
  SELECT count(*)::int INTO v_theirs FROM public.squad_friends WHERE user_id = p_user_id;

  IF v_mine >= public.squad_friend_limit() OR v_theirs >= public.squad_friend_limit() THEN
    RAISE EXCEPTION 'Squad full';
  END IF;

  INSERT INTO public.squad_requests (from_user_id, to_user_id, status)
  VALUES (v_uid, p_user_id, 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'request_id', v_id, 'already_pending', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_squad_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_squad_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_squad_invite(p_request_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_req public.squad_requests%ROWTYPE;
  v_mine int;
  v_theirs int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT * INTO v_req
  FROM public.squad_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_req.to_user_id <> v_uid OR v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF p_accept IS NOT TRUE THEN
    UPDATE public.squad_requests
    SET status = 'declined', updated_at = now()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'accepted', false);
  END IF;

  SELECT count(*)::int INTO v_mine FROM public.squad_friends WHERE user_id = v_uid;
  SELECT count(*)::int INTO v_theirs FROM public.squad_friends WHERE user_id = v_req.from_user_id;

  IF v_mine >= public.squad_friend_limit() OR v_theirs >= public.squad_friend_limit() THEN
    RAISE EXCEPTION 'Squad full';
  END IF;

  PERFORM public.squad_become_friends(v_req.from_user_id, v_req.to_user_id);
  RETURN jsonb_build_object('ok', true, 'accepted', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_squad_invite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_squad_invite(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_squad_invite(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_req public.squad_requests%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_req
  FROM public.squad_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_req.from_user_id <> v_uid OR v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  UPDATE public.squad_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_squad_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_squad_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_squad_friend(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  DELETE FROM public.squad_friends
  WHERE (user_id = v_uid AND friend_user_id = p_user_id)
     OR (user_id = p_user_id AND friend_user_id = v_uid);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_squad_friend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_squad_friend(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.squad_invite_preview(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_code text;
  v_owner uuid;
  v_username text;
  v_nickname text;
BEGIN
  v_code := upper(btrim(coalesce(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT c.user_id, p.username, p.nickname
  INTO v_owner, v_username, v_nickname
  FROM public.squad_invite_codes c
  INNER JOIN public.athlete_profiles p ON p.user_id = c.user_id
  WHERE c.invite_code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'username', v_username,
    'nickname', v_nickname
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.squad_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.squad_invite_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_squad_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_code text;
  v_owner uuid;
  v_mine int;
  v_theirs int;
  v_req public.squad_requests%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_code := upper(btrim(coalesce(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.squad_invite_codes
  WHERE invite_code = v_code
  FOR UPDATE;

  IF NOT FOUND OR v_owner = v_uid THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = v_uid AND friend_user_id = v_owner
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_friends', true);
  END IF;

  SELECT count(*)::int INTO v_mine FROM public.squad_friends WHERE user_id = v_uid;
  SELECT count(*)::int INTO v_theirs FROM public.squad_friends WHERE user_id = v_owner;

  IF v_mine >= public.squad_friend_limit() OR v_theirs >= public.squad_friend_limit() THEN
    RAISE EXCEPTION 'Squad full';
  END IF;

  SELECT * INTO v_req
  FROM public.squad_requests
  WHERE status = 'pending'
    AND (
      (from_user_id = v_owner AND to_user_id = v_uid)
      OR (from_user_id = v_uid AND to_user_id = v_owner)
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.squad_requests (from_user_id, to_user_id, status)
    VALUES (v_owner, v_uid, 'pending');
  END IF;

  PERFORM public.squad_become_friends(v_owner, v_uid);
  RETURN jsonb_build_object('ok', true, 'already_friends', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_squad_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_squad_invite_code(text) TO authenticated;
