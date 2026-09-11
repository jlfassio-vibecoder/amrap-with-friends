-- In-app invitations: one invitation record, per-recipient deliveries, chat
-- attachments, and a unified inbox that absorbs pending assigned workouts.
--
-- Assigned workouts stay as the workout payload / start path. Each pending
-- (and historical) assignment is wrapped in an invitation + delivery so the
-- inbox has a single read model and cannot show the same send twice.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invitation_type text NOT NULL,
  target_mission_id uuid REFERENCES public.missions (id) ON DELETE SET NULL,
  target_campaign_id uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  source_mission_id uuid REFERENCES public.missions (id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  note text,
  duration_minutes int,
  workout jsonb,
  template_id text,
  intensity_tier int,
  include_squad_invite boolean NOT NULL DEFAULT false,
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_type_allowed CHECK (
    invitation_type IN ('mission', 'workout', 'campaign')
  ),
  CONSTRAINT invitations_note_length CHECK (note IS NULL OR length(note) <= 200),
  CONSTRAINT invitations_duration_range CHECK (
    duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 60
  ),
  CONSTRAINT invitations_intensity_range CHECK (
    intensity_tier IS NULL OR intensity_tier BETWEEN 1 AND 5
  ),
  CONSTRAINT invitations_template_length CHECK (
    template_id IS NULL OR length(template_id) <= 120
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_sender_client_request_uidx
  ON public.invitations (from_user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_from_user
  ON public.invitations (from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_source_mission
  ON public.invitations (source_mission_id)
  WHERE source_mission_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.invitation_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  read_at timestamptz,
  assigned_workout_id uuid REFERENCES public.assigned_workouts (id) ON DELETE SET NULL,
  squad_request_id uuid REFERENCES public.squad_requests (id) ON DELETE SET NULL,
  resulting_mission_id uuid REFERENCES public.missions (id) ON DELETE SET NULL,
  resulting_campaign_id uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT invitation_deliveries_status_allowed CHECK (
    status IN ('pending', 'accepted', 'dismissed', 'unavailable')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS invitation_deliveries_pair_uidx
  ON public.invitation_deliveries (invitation_id, to_user_id);

CREATE INDEX IF NOT EXISTS idx_invitation_deliveries_to_user
  ON public.invitation_deliveries (to_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.invitation_blocks (
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_user_id, sender_user_id),
  CONSTRAINT invitation_blocks_not_self CHECK (recipient_user_id <> sender_user_id)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.invitation_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitation_deliveries FROM PUBLIC, anon, authenticated;
ALTER TABLE public.invitation_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitation_blocks FROM PUBLIC, anon, authenticated;

ALTER TABLE public.assigned_workouts
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES public.invitations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assigned_workouts_invitation
  ON public.assigned_workouts (invitation_id)
  WHERE invitation_id IS NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment jsonb;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_attachment_shape;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_shape CHECK (
    attachment IS NULL
    OR (
      jsonb_typeof(attachment) = 'object'
      AND attachment ->> 'type' = 'invitation'
      AND (attachment ->> 'invitation_id') IS NOT NULL
    )
  );

GRANT SELECT (attachment) ON public.messages TO authenticated;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS members_can_invite boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Backfill pending (and historical) assigned workouts so the inbox is one list
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r public.assigned_workouts%ROWTYPE;
  v_inv uuid;
  v_status text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.assigned_workouts
    WHERE invitation_id IS NULL
  LOOP
    INSERT INTO public.invitations (
      from_user_id,
      invitation_type,
      duration_minutes,
      workout,
      template_id,
      intensity_tier,
      note,
      created_at
    )
    VALUES (
      r.from_user_id,
      'workout',
      r.duration_minutes,
      r.workout,
      r.template_id,
      r.intensity_tier,
      r.note,
      r.created_at
    )
    RETURNING id INTO v_inv;

    v_status := CASE r.status
      WHEN 'started' THEN 'accepted'
      WHEN 'dismissed' THEN 'dismissed'
      ELSE 'pending'
    END;

    INSERT INTO public.invitation_deliveries (
      invitation_id,
      to_user_id,
      status,
      assigned_workout_id,
      resulting_mission_id,
      created_at,
      resolved_at,
      read_at
    )
    VALUES (
      v_inv,
      r.to_user_id,
      v_status,
      r.id,
      r.mission_id,
      r.created_at,
      r.resolved_at,
      CASE
        WHEN v_status = 'pending' THEN NULL
        ELSE coalesce(r.resolved_at, r.created_at)
      END
    );

    UPDATE public.assigned_workouts
    SET invitation_id = v_inv
    WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invitation_sender_pending_limit()
RETURNS int LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 50 $$;

CREATE OR REPLACE FUNCTION public.invitation_require_uid()
RETURNS uuid
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
  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;
  RETURN v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_require_uid() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invitation_is_friend(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = p_a AND friend_user_id = p_b
  );
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_is_friend(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invitation_is_signed_in_participant(
  p_mission_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT p_mission_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.participants
      WHERE mission_id = p_mission_id AND user_id = p_user_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_is_signed_in_participant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invitation_can_invite_campaign(
  p_uid uuid,
  p_campaign_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND (
        c.host_user_id = p_uid
        OR (
          c.members_can_invite
          AND EXISTS (
            SELECT 1 FROM public.campaign_members m
            WHERE m.campaign_id = c.id
              AND m.user_id = p_uid
              AND m.status = 'active'
          )
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_can_invite_campaign(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- Card payload for inbox and chat. Never includes tokens or invite codes.
CREATE OR REPLACE FUNCTION public.invitation_card_json(
  p_invitation_id uuid,
  p_delivery_id uuid,
  p_viewer uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_del public.invitation_deliveries%ROWTYPE;
  v_from text;
  v_mission public.missions%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_host text;
  v_members int;
  v_squad_status text;
  v_already_joined boolean := false;
  v_already_member boolean := false;
  v_joinable_mission boolean := false;
  v_joinable_campaign boolean := false;
BEGIN
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_delivery_id IS NOT NULL THEN
    SELECT * INTO v_del FROM public.invitation_deliveries WHERE id = p_delivery_id;
  END IF;

  SELECT coalesce(p.nickname, p.username) INTO v_from
  FROM public.athlete_profiles p
  WHERE p.user_id = v_inv.from_user_id;

  IF v_inv.target_mission_id IS NOT NULL THEN
    SELECT * INTO v_mission FROM public.missions WHERE id = v_inv.target_mission_id;
    v_already_joined := public.invitation_is_signed_in_participant(
      v_inv.target_mission_id, p_viewer
    );
    v_joinable_mission :=
      v_mission.id IS NOT NULL
      AND v_mission.state = 'waiting'
      AND NOT v_already_joined;
  END IF;

  IF v_inv.target_campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_inv.target_campaign_id;
    SELECT coalesce(p.nickname, p.username) INTO v_host
    FROM public.athlete_profiles p
    WHERE p.user_id = v_campaign.host_user_id;
    SELECT count(*)::int INTO v_members
    FROM public.campaign_members
    WHERE campaign_id = v_campaign.id AND status = 'active';
    v_already_member := EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE campaign_id = v_inv.target_campaign_id
        AND user_id = p_viewer
        AND status = 'active'
    );
    v_joinable_campaign :=
      v_campaign.id IS NOT NULL
      AND v_campaign.status NOT IN ('complete', 'abandoned')
      AND NOT v_already_member
      AND v_members < public.campaign_member_limit();
  END IF;

  IF v_del.squad_request_id IS NOT NULL THEN
    SELECT status INTO v_squad_status
    FROM public.squad_requests
    WHERE id = v_del.squad_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv.id,
    'delivery_id', v_del.id,
    'type', v_inv.invitation_type,
    'status', v_del.status,
    'read_at', v_del.read_at,
    'created_at', coalesce(v_del.created_at, v_inv.created_at),
    'note', v_inv.note,
    'from_user_id', v_inv.from_user_id,
    'from_nickname', coalesce(v_from, 'A squad friend'),
    'include_squad_invite', v_inv.include_squad_invite,
    'duration_minutes', v_inv.duration_minutes,
    'workout', v_inv.workout,
    'template_id', v_inv.template_id,
    'intensity_tier', v_inv.intensity_tier,
    'assigned_workout_id', v_del.assigned_workout_id,
    'squad_request_id', v_del.squad_request_id,
    'squad_status', v_squad_status,
    'resulting_mission_id', v_del.resulting_mission_id,
    'resulting_campaign_id', v_del.resulting_campaign_id,
    'source_mission_id', v_inv.source_mission_id,
    'source_message_id', v_inv.source_message_id,
    'mission', CASE WHEN v_mission.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_mission.id,
      'state', v_mission.state,
      'scheduled_at', v_mission.scheduled_at,
      'duration_minutes', v_mission.duration_minutes,
      'already_joined', v_already_joined,
      'joinable', v_joinable_mission
    ) END,
    'campaign', CASE WHEN v_campaign.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_campaign.id,
      'name', v_campaign.name,
      'week_count', v_campaign.week_count,
      'missions_per_week', v_campaign.missions_per_week,
      'start_date', v_campaign.start_date,
      'status', v_campaign.status,
      'host_nickname', v_host,
      'already_member', v_already_member,
      'joinable', v_joinable_campaign,
      'member_count', v_members
    ) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_card_json(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_type text,
  p_recipient_user_ids uuid[] DEFAULT '{}',
  p_include_all_mission_participants boolean DEFAULT false,
  p_post_in_chat boolean DEFAULT false,
  p_include_squad_invite boolean DEFAULT false,
  p_note text DEFAULT NULL,
  p_target_mission_id uuid DEFAULT NULL,
  p_target_campaign_id uuid DEFAULT NULL,
  p_source_mission_id uuid DEFAULT NULL,
  p_duration_minutes int DEFAULT NULL,
  p_workout jsonb DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_intensity_tier int DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_type text;
  v_note text;
  v_template_id text;
  v_recipients uuid[];
  v_to uuid;
  v_existing public.invitations%ROWTYPE;
  v_inv_id uuid;
  v_mission public.missions%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_duration int;
  v_workout jsonb;
  v_pending int;
  v_sender_pending int;
  v_friend boolean;
  v_co_participant boolean;
  v_assigned_id uuid;
  v_squad_id uuid;
  v_squad_json jsonb;
  v_delivery_count int := 0;
  v_skipped int := 0;
  v_message_id uuid;
  v_participant public.participants%ROWTYPE;
  v_body text;
  v_segment int;
BEGIN
  v_uid := public.invitation_require_uid();
  v_type := btrim(coalesce(p_type, ''));
  IF v_type NOT IN ('mission', 'workout', 'campaign') THEN
    RAISE EXCEPTION 'Pick what to send';
  END IF;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 200 THEN
    RAISE EXCEPTION 'Keep the note to 200 characters or fewer';
  END IF;

  v_template_id := nullif(btrim(coalesce(p_template_id, '')), '');
  IF v_template_id IS NOT NULL AND length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.invitations
    WHERE from_user_id = v_uid AND client_request_id = p_client_request_id;
    IF FOUND THEN
      SELECT count(*)::int INTO v_delivery_count
      FROM public.invitation_deliveries
      WHERE invitation_id = v_existing.id;
      RETURN jsonb_build_object(
        'ok', true,
        'invitation_id', v_existing.id,
        'delivery_count', v_delivery_count,
        'replayed', true,
        'source_message_id', v_existing.source_message_id
      );
    END IF;
  END IF;

  IF v_type = 'mission' THEN
    IF p_target_mission_id IS NULL THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;
    SELECT * INTO v_mission FROM public.missions WHERE id = p_target_mission_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;
    IF NOT public.invitation_is_signed_in_participant(p_target_mission_id, v_uid) THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;
    v_duration := v_mission.duration_minutes;
    v_workout := v_mission.workout;
  ELSIF v_type = 'workout' THEN
    v_duration := p_duration_minutes;
    IF v_duration IS NULL OR v_duration < 1 OR v_duration > 60 THEN
      RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
    END IF;
    IF NOT public.validate_workout(p_workout) THEN
      RAISE EXCEPTION 'Invalid workout format';
    END IF;
    v_workout := p_workout;
    IF p_intensity_tier IS NOT NULL AND (p_intensity_tier < 1 OR p_intensity_tier > 5) THEN
      RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
    END IF;
  ELSIF v_type = 'campaign' THEN
    IF p_target_campaign_id IS NULL THEN
      RAISE EXCEPTION 'That campaign is not available';
    END IF;
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_target_campaign_id;
    IF NOT FOUND OR NOT public.invitation_can_invite_campaign(v_uid, v_campaign.id) THEN
      RAISE EXCEPTION 'That campaign is not available';
    END IF;
    IF v_campaign.status IN ('complete', 'abandoned') THEN
      RAISE EXCEPTION 'Campaign closed';
    END IF;
  END IF;

  IF p_source_mission_id IS NOT NULL THEN
    IF NOT public.invitation_is_signed_in_participant(p_source_mission_id, v_uid) THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;
  END IF;

  IF p_post_in_chat AND p_source_mission_id IS NULL THEN
    RAISE EXCEPTION 'Post in chat needs this mission';
  END IF;

  v_recipients := ARRAY(
    SELECT DISTINCT u
    FROM unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) AS u
    WHERE u IS NOT NULL AND u <> v_uid
  );

  IF p_include_all_mission_participants THEN
    IF p_source_mission_id IS NULL THEN
      RAISE EXCEPTION 'Pick people in this mission';
    END IF;
    v_recipients := ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        v_recipients || ARRAY(
          SELECT p.user_id
          FROM public.participants p
          WHERE p.mission_id = p_source_mission_id
            AND p.user_id IS NOT NULL
            AND p.user_id <> v_uid
        )
      ) AS x
      WHERE x IS NOT NULL
    );
  END IF;

  IF coalesce(array_length(v_recipients, 1), 0) = 0 AND NOT p_post_in_chat THEN
    RAISE EXCEPTION 'Pick someone to send it to';
  END IF;

  SELECT count(*)::int INTO v_sender_pending
  FROM public.invitation_deliveries d
  INNER JOIN public.invitations i ON i.id = d.invitation_id
  WHERE i.from_user_id = v_uid AND d.status = 'pending';

  IF v_sender_pending + coalesce(array_length(v_recipients, 1), 0)
       > public.invitation_sender_pending_limit() THEN
    RAISE EXCEPTION 'They have not picked up your last few invitations yet';
  END IF;

  -- Validate explicit recipients before insert so a refusal cannot leave a
  -- half-written invitation. Bulk "everyone" skips ineligible people.
  IF coalesce(array_length(v_recipients, 1), 0) > 0
     AND NOT p_include_all_mission_participants THEN
    FOREACH v_to IN ARRAY v_recipients
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.invitation_blocks
        WHERE recipient_user_id = v_to AND sender_user_id = v_uid
      ) THEN
        RAISE EXCEPTION 'They have blocked invitations from you';
      END IF;
      v_friend := public.invitation_is_friend(v_uid, v_to);
      v_co_participant := public.invitation_is_signed_in_participant(p_source_mission_id, v_to);
      IF NOT v_friend AND NOT v_co_participant THEN
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;
      IF NOT v_friend AND v_type = 'campaign' AND NOT p_include_squad_invite THEN
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;
      IF NOT v_friend AND v_type = 'mission'
         AND p_target_mission_id IS DISTINCT FROM p_source_mission_id THEN
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;
      IF p_include_squad_invite AND NOT v_friend AND NOT v_co_participant THEN
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.invitations (
    from_user_id,
    invitation_type,
    target_mission_id,
    target_campaign_id,
    source_mission_id,
    note,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    include_squad_invite,
    client_request_id
  )
  VALUES (
    v_uid,
    v_type,
    CASE WHEN v_type = 'mission' THEN p_target_mission_id ELSE NULL END,
    CASE WHEN v_type = 'campaign' THEN p_target_campaign_id ELSE NULL END,
    p_source_mission_id,
    v_note,
    v_duration,
    v_workout,
    v_template_id,
    CASE WHEN v_type = 'workout' THEN p_intensity_tier ELSE NULL END,
    p_include_squad_invite,
    p_client_request_id
  )
  RETURNING id INTO v_inv_id;

  IF coalesce(array_length(v_recipients, 1), 0) > 0 THEN
    FOREACH v_to IN ARRAY v_recipients
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.invitation_blocks
        WHERE recipient_user_id = v_to AND sender_user_id = v_uid
      ) THEN
        IF p_include_all_mission_participants THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        RAISE EXCEPTION 'They have blocked invitations from you';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_to) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_friend := public.invitation_is_friend(v_uid, v_to);
      v_co_participant := public.invitation_is_signed_in_participant(p_source_mission_id, v_to);

      IF NOT v_friend AND NOT v_co_participant THEN
        IF p_include_all_mission_participants THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;

      IF NOT v_friend AND v_type = 'campaign' AND NOT p_include_squad_invite THEN
        IF p_include_all_mission_participants THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;

      IF NOT v_friend AND v_type = 'mission'
         AND p_target_mission_id IS DISTINCT FROM p_source_mission_id THEN
        IF p_include_all_mission_participants THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        RAISE EXCEPTION 'Pick a squad friend to send it to';
      END IF;

      PERFORM pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(v_to::text));

      SELECT count(*)::int INTO v_pending
      FROM public.invitation_deliveries d
      INNER JOIN public.invitations i ON i.id = d.invitation_id
      WHERE d.to_user_id = v_to
        AND i.from_user_id = v_uid
        AND d.status = 'pending';

      IF v_pending >= public.assigned_workout_pending_limit() THEN
        IF p_include_all_mission_participants THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
        RAISE EXCEPTION 'They have not picked up your last few invitations yet';
      END IF;

      v_assigned_id := NULL;
      IF v_type = 'workout' THEN
        INSERT INTO public.assigned_workouts (
          from_user_id,
          to_user_id,
          duration_minutes,
          workout,
          template_id,
          intensity_tier,
          note,
          invitation_id
        )
        VALUES (
          v_uid,
          v_to,
          v_duration,
          v_workout,
          v_template_id,
          p_intensity_tier,
          v_note,
          v_inv_id
        )
        RETURNING id INTO v_assigned_id;
      END IF;

      v_squad_id := NULL;
      IF p_include_squad_invite AND NOT v_friend THEN
        IF NOT v_co_participant THEN
          RAISE EXCEPTION 'Pick a squad friend to send it to';
        END IF;
        v_squad_json := public.send_squad_invite(v_to);
        v_squad_id := (v_squad_json ->> 'request_id')::uuid;
      END IF;

      INSERT INTO public.invitation_deliveries (
        invitation_id,
        to_user_id,
        assigned_workout_id,
        squad_request_id
      )
      VALUES (v_inv_id, v_to, v_assigned_id, v_squad_id);
      v_delivery_count := v_delivery_count + 1;
    END LOOP;
  END IF;

  IF p_post_in_chat THEN
    SELECT * INTO v_participant
    FROM public.participants
    WHERE mission_id = p_source_mission_id
      AND user_id = v_uid
    ORDER BY CASE WHEN role = 'host' THEN 0 ELSE 1 END, joined_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_source_mission_id::text || ':' || v_participant.id::text, 0)
    );

    IF EXISTS (
      SELECT 1 FROM public.messages
      WHERE mission_id = p_source_mission_id
        AND participant_id = v_participant.id
        AND created_at > now() - interval '2 seconds'
    ) THEN
      RAISE EXCEPTION 'Slow down — wait a moment before sending again';
    END IF;

    SELECT segment_index INTO v_segment
    FROM public.missions
    WHERE id = p_source_mission_id;

    v_body := CASE v_type
      WHEN 'campaign' THEN 'Shared a campaign invitation'
      WHEN 'workout' THEN 'Shared a workout'
      ELSE 'Shared a mission invitation'
    END;

    INSERT INTO public.messages (
      mission_id,
      participant_id,
      nickname,
      body,
      segment_index,
      attachment
    )
    VALUES (
      p_source_mission_id,
      v_participant.id,
      v_participant.nickname,
      v_body,
      coalesce(v_segment, 0),
      jsonb_build_object('type', 'invitation', 'invitation_id', v_inv_id)
    )
    RETURNING id INTO v_message_id;

    UPDATE public.invitations
    SET source_message_id = v_message_id
    WHERE id = v_inv_id;
  END IF;

  IF v_delivery_count = 0 AND NOT p_post_in_chat THEN
    RAISE EXCEPTION 'Pick someone to send it to';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', v_inv_id,
    'delivery_count', v_delivery_count,
    'skipped', v_skipped,
    'replayed', false,
    'source_message_id', v_message_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(
  text, uuid[], boolean, boolean, boolean, text, uuid, uuid, uuid, int, jsonb, text, int, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(
  text, uuid[], boolean, boolean, boolean, text, uuid, uuid, uuid, int, jsonb, text, int, uuid
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Inbox
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_pending jsonb;
  v_resolved jsonb;
  v_unread int;
BEGIN
  v_uid := public.invitation_require_uid();

  SELECT coalesce(jsonb_agg(public.invitation_card_json(d.invitation_id, d.id, v_uid) ORDER BY d.created_at DESC), '[]'::jsonb)
  INTO v_pending
  FROM public.invitation_deliveries d
  WHERE d.to_user_id = v_uid AND d.status = 'pending';

  SELECT coalesce(
    jsonb_agg(public.invitation_card_json(d.invitation_id, d.id, v_uid) ORDER BY d.resolved_at DESC NULLS LAST),
    '[]'::jsonb
  )
  INTO v_resolved
  FROM (
    SELECT *
    FROM public.invitation_deliveries
    WHERE to_user_id = v_uid AND status IN ('accepted', 'dismissed', 'unavailable')
    ORDER BY coalesce(resolved_at, created_at) DESC
    LIMIT 20
  ) d;

  SELECT count(*)::int INTO v_unread
  FROM public.invitation_deliveries
  WHERE to_user_id = v_uid AND status = 'pending' AND read_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'invitations', v_pending,
    'resolved', v_resolved,
    'unread_count', v_unread
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_invitation_unread_count()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_unread int;
BEGIN
  v_uid := public.invitation_require_uid();
  SELECT count(*)::int INTO v_unread
  FROM public.invitation_deliveries
  WHERE to_user_id = v_uid AND status = 'pending' AND read_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'unread_count', v_unread);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_invitation_unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invitation_unread_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_invitations_read(p_delivery_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := public.invitation_require_uid();
  UPDATE public.invitation_deliveries
  SET read_at = now()
  WHERE to_user_id = v_uid
    AND status = 'pending'
    AND read_at IS NULL
    AND (p_delivery_ids IS NULL OR id = ANY (p_delivery_ids));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_invitations_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invitations_read(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_invitation(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_del public.invitation_deliveries%ROWTYPE;
BEGIN
  v_uid := public.invitation_require_uid();
  SELECT * INTO v_del
  FROM public.invitation_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  IF NOT FOUND OR v_del.to_user_id <> v_uid OR v_del.status <> 'pending' THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  UPDATE public.invitation_deliveries
  SET status = 'dismissed', resolved_at = now(), read_at = coalesce(read_at, now())
  WHERE id = v_del.id;

  IF v_del.assigned_workout_id IS NOT NULL THEN
    UPDATE public.assigned_workouts
    SET status = 'dismissed', resolved_at = now()
    WHERE id = v_del.assigned_workout_id
      AND to_user_id = v_uid
      AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('ok', true, 'delivery_id', v_del.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dismiss_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_invitation_sender(p_from_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := public.invitation_require_uid();
  IF p_from_user_id IS NULL OR p_from_user_id = v_uid THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;
  INSERT INTO public.invitation_blocks (recipient_user_id, sender_user_id)
  VALUES (v_uid, p_from_user_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.invitation_deliveries d
  SET status = 'dismissed', resolved_at = coalesce(d.resolved_at, now()), read_at = coalesce(d.read_at, now())
  FROM public.invitations i
  WHERE d.invitation_id = i.id
    AND d.to_user_id = v_uid
    AND i.from_user_id = p_from_user_id
    AND d.status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_invitation_sender(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_invitation_sender(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Accept / start
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_delivery_id uuid,
  p_nickname text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_del public.invitation_deliveries%ROWTYPE;
  v_inv public.invitations%ROWTYPE;
  v_nickname text;
  v_joined jsonb;
  v_created jsonb;
  v_code text;
  v_host_token text;
  v_participant_id uuid;
  v_campaign_id uuid;
BEGIN
  v_uid := public.invitation_require_uid();

  SELECT * INTO v_del
  FROM public.invitation_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  IF NOT FOUND OR v_del.to_user_id <> v_uid THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = v_del.invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  v_nickname := nullif(btrim(coalesce(p_nickname, '')), '');
  IF v_nickname IS NULL THEN
    SELECT coalesce(nickname, username) INTO v_nickname
    FROM public.athlete_profiles
    WHERE user_id = v_uid;
  END IF;
  IF v_nickname IS NULL OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  -- Recover a workout start that already committed.
  IF v_inv.invitation_type = 'workout'
     AND v_del.status = 'accepted'
     AND v_del.resulting_mission_id IS NOT NULL THEN
    SELECT host_token INTO v_host_token
    FROM public.missions
    WHERE id = v_del.resulting_mission_id;
    SELECT id INTO v_participant_id
    FROM public.participants
    WHERE mission_id = v_del.resulting_mission_id
      AND user_id = v_uid
    ORDER BY CASE WHEN role = 'host' THEN 0 ELSE 1 END, joined_at ASC
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'workout',
      'recovered', true,
      'mission_id', v_del.resulting_mission_id,
      'host_token', v_host_token,
      'participant_id', v_participant_id,
      'claim_token', NULL
    );
  END IF;

  IF v_del.status = 'accepted' AND v_inv.invitation_type = 'mission' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'mission',
      'mission_id', coalesce(v_del.resulting_mission_id, v_inv.target_mission_id),
      'already_member', true
    );
  END IF;

  IF v_del.status = 'accepted' AND v_inv.invitation_type = 'campaign' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'campaign',
      'campaign_id', coalesce(v_del.resulting_campaign_id, v_inv.target_campaign_id),
      'already_member', true
    );
  END IF;

  IF v_del.status <> 'pending' THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  IF v_inv.invitation_type = 'mission' THEN
    BEGIN
      v_joined := public.join_mission(v_inv.target_mission_id, v_nickname);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE '%Mission locked%'
         OR SQLERRM ILIKE '%Mission is full%'
         OR SQLERRM ILIKE '%Mission not found%' THEN
        UPDATE public.invitation_deliveries
        SET status = 'unavailable', resolved_at = now(), read_at = coalesce(read_at, now())
        WHERE id = v_del.id;
        RAISE EXCEPTION 'That invitation is not available';
      END IF;
      RAISE;
    END;
    UPDATE public.invitation_deliveries
    SET status = 'accepted',
        resolved_at = now(),
        read_at = coalesce(read_at, now()),
        resulting_mission_id = v_inv.target_mission_id
    WHERE id = v_del.id;
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'mission',
      'mission_id', v_inv.target_mission_id,
      'participant_id', v_joined ->> 'participant_id',
      'claim_token', v_joined -> 'claim_token',
      'host_token', v_joined -> 'host_token',
      'nickname', v_joined ->> 'nickname',
      'role', v_joined ->> 'role'
    );
  END IF;

  IF v_inv.invitation_type = 'campaign' THEN
    SELECT invite_code INTO v_code
    FROM public.campaigns
    WHERE id = v_inv.target_campaign_id
    FOR UPDATE;
    IF NOT FOUND THEN
      UPDATE public.invitation_deliveries
      SET status = 'unavailable', resolved_at = now(), read_at = coalesce(read_at, now())
      WHERE id = v_del.id;
      RAISE EXCEPTION 'That invitation is not available';
    END IF;
    BEGIN
      v_joined := public.join_campaign(v_code);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM ILIKE '%Campaign closed%'
         OR SQLERRM ILIKE '%Campaign full%'
         OR SQLERRM ILIKE '%Campaign not found%' THEN
        UPDATE public.invitation_deliveries
        SET status = 'unavailable', resolved_at = now(), read_at = coalesce(read_at, now())
        WHERE id = v_del.id;
        RAISE EXCEPTION 'That invitation is not available';
      END IF;
      RAISE;
    END;
    v_campaign_id := coalesce((v_joined ->> 'campaign_id')::uuid, v_inv.target_campaign_id);
    UPDATE public.invitation_deliveries
    SET status = 'accepted',
        resolved_at = now(),
        read_at = coalesce(read_at, now()),
        resulting_campaign_id = v_campaign_id
    WHERE id = v_del.id;
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'campaign',
      'campaign_id', v_campaign_id,
      'already_member', v_joined -> 'already_member'
    );
  END IF;

  -- workout: create the mission and mark started in one transaction.
  v_created := public.create_mission(
    v_inv.duration_minutes,
    v_nickname,
    v_inv.workout,
    v_inv.template_id,
    v_inv.intensity_tier,
    NULL,
    NULL
  );

  IF v_del.assigned_workout_id IS NOT NULL THEN
    UPDATE public.assigned_workouts
    SET status = 'started',
        mission_id = (v_created ->> 'mission_id')::uuid,
        resolved_at = now()
    WHERE id = v_del.assigned_workout_id
      AND to_user_id = v_uid
      AND status = 'pending';
  END IF;

  UPDATE public.invitation_deliveries
  SET status = 'accepted',
      resolved_at = now(),
      read_at = coalesce(read_at, now()),
      resulting_mission_id = (v_created ->> 'mission_id')::uuid
  WHERE id = v_del.id;

  RETURN jsonb_build_object(
    'ok', true,
    'type', 'workout',
    'recovered', false,
    'mission_id', v_created -> 'mission_id',
    'host_token', v_created -> 'host_token',
    'participant_id', v_created -> 'participant_id',
    'claim_token', v_created -> 'claim_token'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_invitation_squad(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_del public.invitation_deliveries%ROWTYPE;
  v_result jsonb;
BEGIN
  v_uid := public.invitation_require_uid();
  SELECT * INTO v_del
  FROM public.invitation_deliveries
  WHERE id = p_delivery_id;
  IF NOT FOUND OR v_del.to_user_id <> v_uid OR v_del.squad_request_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  v_result := public.respond_squad_invite(v_del.squad_request_id, true);
  RETURN jsonb_build_object('ok', true, 'accepted', v_result -> 'accepted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation_squad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation_squad(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_chat_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_inv public.invitations%ROWTYPE;
  v_existing public.invitation_deliveries%ROWTYPE;
  v_friend boolean;
  v_co boolean;
  v_assigned_id uuid;
  v_id uuid;
  v_pending int;
BEGIN
  v_uid := public.invitation_require_uid();
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND OR v_inv.source_message_id IS NULL OR v_inv.source_mission_id IS NULL THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;
  IF v_inv.from_user_id = v_uid THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;
  -- Verified claiming: must be the signed-in participant, never a nickname match.
  IF NOT public.invitation_is_signed_in_participant(v_inv.source_mission_id, v_uid) THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.invitation_blocks
    WHERE recipient_user_id = v_uid AND sender_user_id = v_inv.from_user_id
  ) THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  SELECT * INTO v_existing
  FROM public.invitation_deliveries
  WHERE invitation_id = v_inv.id AND to_user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'delivery_id', v_existing.id, 'already', true);
  END IF;

  v_friend := public.invitation_is_friend(v_inv.from_user_id, v_uid);
  v_co := true;
  IF NOT v_friend AND v_inv.invitation_type = 'campaign' AND NOT v_inv.include_squad_invite THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_inv.from_user_id::text), hashtext(v_uid::text));
  SELECT count(*)::int INTO v_pending
  FROM public.invitation_deliveries d
  INNER JOIN public.invitations i ON i.id = d.invitation_id
  WHERE d.to_user_id = v_uid
    AND i.from_user_id = v_inv.from_user_id
    AND d.status = 'pending';
  IF v_pending >= public.assigned_workout_pending_limit() THEN
    RAISE EXCEPTION 'They have not picked up your last few invitations yet';
  END IF;

  IF v_inv.invitation_type = 'workout' THEN
    INSERT INTO public.assigned_workouts (
      from_user_id, to_user_id, duration_minutes, workout, template_id, intensity_tier, note, invitation_id
    )
    VALUES (
      v_inv.from_user_id, v_uid, v_inv.duration_minutes, v_inv.workout,
      v_inv.template_id, v_inv.intensity_tier, v_inv.note, v_inv.id
    )
    RETURNING id INTO v_assigned_id;
  END IF;

  INSERT INTO public.invitation_deliveries (
    invitation_id, to_user_id, assigned_workout_id
  )
  VALUES (v_inv.id, v_uid, v_assigned_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'delivery_id', v_id, 'already', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_chat_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_chat_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.invitation_audience(p_source_mission_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_squad jsonb;
  v_participants jsonb;
  v_campaigns jsonb;
BEGIN
  v_uid := public.invitation_require_uid();

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'user_id', f.friend_user_id,
      'nickname', coalesce(p.nickname, p.username, 'Athlete')
    ) ORDER BY coalesce(p.nickname, p.username)),
    '[]'::jsonb
  )
  INTO v_squad
  FROM public.squad_friends f
  INNER JOIN public.athlete_profiles p ON p.user_id = f.friend_user_id
  WHERE f.user_id = v_uid;

  v_participants := '[]'::jsonb;
  IF p_source_mission_id IS NOT NULL THEN
    IF NOT public.invitation_is_signed_in_participant(p_source_mission_id, v_uid) THEN
      RAISE EXCEPTION 'That mission is not available';
    END IF;
    SELECT coalesce(
      jsonb_agg(jsonb_build_object(
        'user_id', part.user_id,
        'participant_id', part.id,
        'nickname', part.nickname,
        'is_friend', public.invitation_is_friend(v_uid, part.user_id),
        'is_self', part.user_id = v_uid
      ) ORDER BY part.joined_at),
      '[]'::jsonb
    )
    INTO v_participants
    FROM public.participants part
    WHERE part.mission_id = p_source_mission_id
      AND part.user_id IS NOT NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'campaign_id', c.id,
      'name', c.name,
      'week_count', c.week_count,
      'missions_per_week', c.missions_per_week,
      'start_date', c.start_date,
      'is_host', c.host_user_id = v_uid
    ) ORDER BY c.created_at DESC),
    '[]'::jsonb
  )
  INTO v_campaigns
  FROM public.campaigns c
  WHERE c.status NOT IN ('complete', 'abandoned')
    AND public.invitation_can_invite_campaign(v_uid, c.id);

  RETURN jsonb_build_object(
    'ok', true,
    'squad', v_squad,
    'mission_participants', v_participants,
    'campaigns', v_campaigns
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invitation_audience(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invitation_audience(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invitation_preview(
  p_invitation_id uuid,
  p_source_mission_id uuid DEFAULT NULL,
  p_participant_id uuid DEFAULT NULL,
  p_claim_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_inv public.invitations%ROWTYPE;
  v_del public.invitation_deliveries%ROWTYPE;
  v_authorized boolean := false;
  v_hash text;
  v_claim_hash text;
  v_part_user uuid;
  v_part_mission uuid;
  v_viewer uuid;
  v_card jsonb;
BEGIN
  v_uid := auth.uid();
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  IF v_uid IS NOT NULL AND v_uid = v_inv.from_user_id THEN
    v_authorized := true;
    v_viewer := v_uid;
  END IF;

  IF NOT v_authorized AND v_uid IS NOT NULL THEN
    SELECT * INTO v_del
    FROM public.invitation_deliveries
    WHERE invitation_id = v_inv.id AND to_user_id = v_uid;
    IF FOUND THEN
      v_authorized := true;
      v_viewer := v_uid;
    END IF;
  END IF;

  IF NOT v_authorized AND v_uid IS NOT NULL AND v_inv.source_mission_id IS NOT NULL
     AND public.invitation_is_signed_in_participant(v_inv.source_mission_id, v_uid) THEN
    v_authorized := true;
    v_viewer := v_uid;
  END IF;

  IF NOT v_authorized
     AND p_participant_id IS NOT NULL
     AND p_source_mission_id IS NOT NULL
     AND v_inv.source_mission_id = p_source_mission_id THEN
    SELECT claim_token_hash, user_id, mission_id
    INTO v_claim_hash, v_part_user, v_part_mission
    FROM public.participants
    WHERE id = p_participant_id;
    IF FOUND AND v_part_mission = p_source_mission_id THEN
      IF v_uid IS NOT NULL AND v_part_user IS NOT NULL AND v_part_user = v_uid THEN
        v_authorized := true;
        v_viewer := v_uid;
      ELSIF v_claim_hash IS NOT NULL AND p_claim_token IS NOT NULL THEN
        v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
        IF v_hash = v_claim_hash THEN
          v_authorized := true;
          v_viewer := v_part_user;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'That invitation is not available';
  END IF;

  v_card := public.invitation_card_json(v_inv.id, v_del.id, v_viewer);
  RETURN jsonb_build_object('ok', true, 'invitation', v_card);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invitation_preview(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid, uuid, uuid, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_campaign_members_can_invite(
  p_campaign_id uuid,
  p_enabled boolean
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
  v_uid := public.invitation_require_uid();
  UPDATE public.campaigns
  SET members_can_invite = coalesce(p_enabled, false), updated_at = now()
  WHERE id = p_campaign_id AND host_user_id = v_uid;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;
  RETURN jsonb_build_object('ok', true, 'members_can_invite', coalesce(p_enabled, false));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_campaign_members_can_invite(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_campaign_members_can_invite(uuid, boolean)
  TO authenticated;

-- Old assign_workout path now writes the same invitation records so the inbox
-- cannot miss a send, and cannot show one assignment as two items.
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
  v_result jsonb;
  v_delivery_id uuid;
  v_assigned_id uuid;
BEGIN
  v_result := public.create_invitation(
    'workout',
    ARRAY[p_to_user_id],
    false,
    false,
    false,
    p_note,
    NULL,
    NULL,
    NULL,
    p_duration_minutes,
    p_workout,
    p_template_id,
    p_intensity_tier,
    NULL
  );
  SELECT d.id, d.assigned_workout_id
  INTO v_delivery_id, v_assigned_id
  FROM public.invitation_deliveries d
  WHERE d.invitation_id = (v_result ->> 'invitation_id')::uuid
  LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true,
    'assigned_workout_id', v_assigned_id,
    'invitation_id', v_result -> 'invitation_id',
    'delivery_id', v_delivery_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Live state: include message.attachment so chat cards bootstrap for guests
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_mission_live_state(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_host_token text;
  v_hash text;
  v_authorized boolean := false;
  v_mission jsonb;
  v_participants jsonb;
  v_participant_ids jsonb;
  v_rounds jsonb;
  v_messages jsonb;
  v_segment_results jsonb;
  v_incremental boolean := p_since IS NOT NULL;
  v_snapshot_at timestamptz := clock_timestamp();
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT host_token
  INTO v_host_token
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF p_host_token IS NOT NULL AND p_host_token = v_host_token THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_claim_token_hash IS NOT NULL
    AND p_claim_token IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF v_incremental THEN
    SELECT to_jsonb(m)
    INTO v_mission
    FROM (
      SELECT
        id,
        duration_minutes,
        template_id,
        state,
        time_left_sec,
        is_paused,
        started_at,
        scheduled_at,
        rally_point_countdown_ends_at,
        segment_index,
        created_at,
        is_featured,
        rally_point_id
      FROM public.missions
      WHERE id = p_mission_id
    ) m;

    SELECT coalesce(jsonb_agg(p.id ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participant_ids
    FROM public.participants p
    WHERE p.mission_id = p_mission_id;

    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participants
    FROM (
      SELECT id, mission_id, nickname, role, joined_at
      FROM public.participants
      WHERE mission_id = p_mission_id
        AND joined_at >= p_since
    ) p;
  ELSE
    SELECT to_jsonb(m)
    INTO v_mission
    FROM (
      SELECT
        id,
        duration_minutes,
        workout,
        template_id,
        state,
        time_left_sec,
        is_paused,
        started_at,
        scheduled_at,
        rally_point_countdown_ends_at,
        segment_index,
        created_at,
        is_featured,
        rally_point_id
      FROM public.missions
      WHERE id = p_mission_id
    ) m;

    v_participant_ids := NULL;

    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participants
    FROM (
      SELECT id, mission_id, nickname, role, joined_at
      FROM public.participants
      WHERE mission_id = p_mission_id
    ) p;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at ASC), '[]'::jsonb)
  INTO v_rounds
  FROM (
    SELECT
      id,
      mission_id,
      participant_id,
      round_index,
      elapsed_sec_at_round,
      segment_index,
      missed_log_reps,
      created_at
    FROM public.rounds
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR created_at > p_since)
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(msg) ORDER BY msg.created_at ASC), '[]'::jsonb)
  INTO v_messages
  FROM (
    SELECT
      id,
      mission_id,
      participant_id,
      nickname,
      body,
      segment_index,
      created_at,
      attachment
    FROM public.messages
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR created_at > p_since)
    ORDER BY created_at DESC
    LIMIT 50
  ) msg;

  SELECT coalesce(jsonb_agg(to_jsonb(psr) ORDER BY psr.updated_at ASC), '[]'::jsonb)
  INTO v_segment_results
  FROM (
    SELECT
      mission_id,
      participant_id,
      segment_index,
      partial_reps,
      final_score,
      score_breakdown,
      modified_movements,
      movement_variants,
      updated_at
    FROM public.participant_segment_results
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR updated_at > p_since)
  ) psr;

  RETURN jsonb_build_object(
    'ok', true,
    'incremental', v_incremental,
    'snapshot_at', v_snapshot_at,
    'mission', v_mission,
    'participants', v_participants,
    'participant_ids', v_participant_ids,
    'rounds', v_rounds,
    'messages', v_messages,
    'segment_results', v_segment_results
  );
END;
$$;
