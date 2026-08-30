-- 20260901140000 already shipped without unique_violation handling on the
-- fabricated pending insert in accept_squad_invite_code. Concurrent owner
-- send + link accept could surface a raw constraint error; tolerate it and let
-- squad_become_friends accept whichever pending row won.

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
    BEGIN
      INSERT INTO public.squad_requests (from_user_id, to_user_id, status)
      VALUES (v_owner, v_uid, 'pending');
    EXCEPTION WHEN unique_violation THEN
      -- Owner sent an invite in the same instant; become_friends will accept it.
      NULL;
    END;
  END IF;

  PERFORM public.squad_become_friends(v_owner, v_uid);
  RETURN jsonb_build_object('ok', true, 'already_friends', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_squad_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_squad_invite_code(text) TO authenticated;
