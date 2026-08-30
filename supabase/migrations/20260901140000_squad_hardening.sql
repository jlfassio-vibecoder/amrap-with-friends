-- Squad hardening, from an audit of the squad builder against a live database.
--
--   1. The personal invite code could not be rotated. squad_ensure_invite_code
--      creates one and returns it forever, so a link that leaks — posted in a
--      group chat, screenshotted, indexed — lets anyone add themselves to that
--      athlete's squad for good, with no way back other than removing each
--      person by hand. rotate_squad_invite_code() retires the old code.
--
--   2. A declined invite could be re-sent immediately, without limit: five
--      sends and five declines in a row, no throttle. That is the standard
--      harassment vector in a friend system. A decline now costs the sender a
--      cooling-off period, and a third decline ends it permanently.
--
--   3. send_squad_invite checked for an existing pending request and then
--      inserted, so two people inviting each other at the same instant raced
--      the pending-pair unique index and the loser saw a raw Postgres
--      constraint error. The insert now handles that collision.
--
--   4. search_athletes reported that someone had invited you but gave the
--      client no request id, so the result could only be a dead label.

-- How long a decline is respected before the sender may try again, and how
-- many declines end it for good.
CREATE OR REPLACE FUNCTION public.squad_decline_cooldown()
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT interval '7 days' $$;

CREATE OR REPLACE FUNCTION public.squad_decline_limit()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 3 $$;

CREATE OR REPLACE FUNCTION public.rotate_squad_invite_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_code text;
  v_attempt int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));

    BEGIN
      INSERT INTO public.squad_invite_codes (user_id, invite_code)
      VALUES (v_uid, v_code)
      ON CONFLICT (user_id) DO UPDATE
        SET invite_code = EXCLUDED.invite_code, created_at = now();
      RETURN jsonb_build_object('ok', true, 'invite_code', v_code);
    EXCEPTION WHEN unique_violation THEN
      -- Collided with someone else's code; try another.
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'Could not reset the link, please try again';
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_squad_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_squad_invite_code() TO authenticated;

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
  v_declines int;
  v_last_decline timestamptz;
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

  -- A decline is an answer, not a prompt to ask again. Count only this
  -- sender's declined invites, so being declined by someone never limits who
  -- else may invite them.
  SELECT count(*)::int, max(updated_at)
  INTO v_declines, v_last_decline
  FROM public.squad_requests
  WHERE from_user_id = v_uid
    AND to_user_id = p_user_id
    AND status = 'declined';

  IF v_declines >= public.squad_decline_limit() THEN
    RAISE EXCEPTION 'Invite blocked';
  END IF;

  IF v_last_decline IS NOT NULL
     AND v_last_decline > now() - public.squad_decline_cooldown() THEN
    RAISE EXCEPTION 'Invite declined recently';
  END IF;

  SELECT count(*)::int INTO v_mine FROM public.squad_friends WHERE user_id = v_uid;
  SELECT count(*)::int INTO v_theirs FROM public.squad_friends WHERE user_id = p_user_id;

  IF v_mine >= public.squad_friend_limit() OR v_theirs >= public.squad_friend_limit() THEN
    RAISE EXCEPTION 'Squad full';
  END IF;

  -- Two people inviting each other at the same instant both pass the check
  -- above and race the pending-pair unique index. The loser adopts the row
  -- that won rather than surfacing a constraint error.
  BEGIN
    INSERT INTO public.squad_requests (from_user_id, to_user_id, status)
    VALUES (v_uid, p_user_id, 'pending')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.squad_requests
    WHERE status = 'pending'
      AND (
        (from_user_id = v_uid AND to_user_id = p_user_id)
        OR (from_user_id = p_user_id AND to_user_id = v_uid)
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invite not found';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'request_id', v_existing.id,
      'already_pending', true
    );
  END;

  RETURN jsonb_build_object('ok', true, 'request_id', v_id, 'already_pending', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_squad_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_squad_invite(uuid) TO authenticated;

-- Adds request_id so an incoming invite found through search can be accepted
-- there, instead of only telling you one exists.
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
        'status', hit.status,
        'request_id', hit.request_id
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
      END AS status,
      (
        SELECT r.id FROM public.squad_requests r
        WHERE r.status = 'pending'
          AND (
            (r.from_user_id = v_uid AND r.to_user_id = p.user_id)
            OR (r.from_user_id = p.user_id AND r.to_user_id = v_uid)
          )
        LIMIT 1
      ) AS request_id
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

  -- Sharing the link IS the owner's consent, so this friends both sides with
  -- no approval step. The request row exists only so the pair has the same
  -- audit trail as any other friendship; it is attributed to the owner
  -- because they issued the invite, not because they clicked anything here.
  -- A decline never blocks this path: the owner handing out their link after
  -- declining is them changing their mind.
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
