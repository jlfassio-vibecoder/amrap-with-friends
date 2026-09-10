-- Coach's Rooms, phase 1: the boundary and the ledger.
--
-- Nothing user-facing. Every table here exists so that the phases after it are
-- authorized correctly, and so that founding hosts' commissions accrue from
-- their first mission rather than from whenever Stripe arrives.
--
-- Three shapes were decided in docs/plans/coach-rooms-decisions.md and are
-- encoded here:
--   1. Handles are text with a lower(handle) unique index -- not citext.
--   2. Publications carry the workout jsonb, not a snapshot id. (Phase 3.)
--   3. Entitlements have two named write paths, split by `source`.
--
-- Every table is revoked from anon/authenticated. Reads and writes go through
-- SECURITY DEFINER RPCs, per the repo's standing rule.

-- ---------------------------------------------------------------------------
-- Host accounts and rooms
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.host_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'coach',
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT host_accounts_kind_check CHECK (kind IN ('coach', 'gym')),
  CONSTRAINT host_accounts_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_host_accounts_owner ON public.host_accounts (owner_user_id);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_account_id uuid NOT NULL REFERENCES public.host_accounts (id) ON DELETE CASCADE,
  handle text NOT NULL,
  display_name text NOT NULL,
  avatar_path text,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  intro text,
  timezone text NOT NULL DEFAULT 'UTC',
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rooms_visibility_check CHECK (visibility IN ('public')),
  -- Shape is enforced again in checkHandle(); this is the floor, not the rule.
  CONSTRAINT rooms_handle_shape CHECK (handle ~ '^[a-z0-9][a-z0-9_]{2,23}$')
);

-- Decision 1: uniqueness on the lower-cased handle. Every lookup must pass a
-- pre-lowered parameter and match lower(handle), or it will not use this index.
CREATE UNIQUE INDEX IF NOT EXISTS rooms_handle_lower_key ON public.rooms (lower(handle));
CREATE INDEX IF NOT EXISTS idx_rooms_host_account ON public.rooms (host_account_id);

-- A handle change leaves a redirect behind, because rally links and share cards
-- carrying the old one are already in group chats and cannot be recalled.
CREATE TABLE IF NOT EXISTS public.room_handle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  old_handle text NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS room_handle_history_lower_key
  ON public.room_handle_history (lower(old_handle));

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  reminders_enabled boolean NOT NULL DEFAULT true,
  activity_visible boolean NOT NULL DEFAULT true,
  CONSTRAINT room_members_role_check CHECK (role IN ('owner', 'cohost', 'member'))
);

CREATE UNIQUE INDEX IF NOT EXISTS room_members_room_user_key
  ON public.room_members (room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);

-- Three co-hosts, enforced where it cannot be forgotten. A partial unique index
-- cannot express "at most three", so this is a trigger.
CREATE OR REPLACE FUNCTION public.enforce_cohost_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.role <> 'cohost' OR NEW.left_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.room_members
  WHERE room_id = NEW.room_id
    AND role = 'cohost'
    AND left_at IS NULL
    AND id <> NEW.id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Room already has three co-hosts';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_members_cohost_limit ON public.room_members;
CREATE TRIGGER room_members_cohost_limit
  BEFORE INSERT OR UPDATE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cohost_limit();

CREATE TABLE IF NOT EXISTS public.room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz,
  uses int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Home coach and the ledger
-- ---------------------------------------------------------------------------

-- Its own table rather than a column on athlete_profiles: attribution is not a
-- body measurement, an athlete may have one without ever filling in a profile,
-- and the plan's rule is that result, membership and attribution stay three
-- separate records even though the athlete sees one checkbox.
CREATE TABLE IF NOT EXISTS public.athlete_home_coach (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms (id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_home_coach_not_self CHECK (user_id <> coach_user_id)
);

CREATE INDEX IF NOT EXISTS idx_athlete_home_coach_coach
  ON public.athlete_home_coach (coach_user_id);

CREATE TABLE IF NOT EXISTS public.referral_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms (id) ON DELETE SET NULL,
  event text NOT NULL,
  amount_net_cents int,
  tier_share numeric(4, 3),
  stripe_invoice_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_ledger_event_check
    CHECK (event IN ('attributed', 'purchase', 'refund')),
  -- An attribution is not money; a purchase and a refund are. Keeping the
  -- shapes apart here means a miswritten row fails loudly instead of quietly
  -- entering a payout total.
  CONSTRAINT referral_ledger_amount_shape CHECK (
    (event = 'attributed' AND amount_net_cents IS NULL AND tier_share IS NULL)
    OR (event <> 'attributed' AND amount_net_cents IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_referral_ledger_coach
  ON public.referral_ledger (coach_user_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS referral_ledger_invoice_key
  ON public.referral_ledger (stripe_invoice_id, event)
  WHERE stripe_invoice_id IS NOT NULL;
-- One attribution per athlete per coach; joining a second time is not a second
-- referral record.
CREATE UNIQUE INDEX IF NOT EXISTS referral_ledger_attributed_key
  ON public.referral_ledger (athlete_user_id, coach_user_id)
  WHERE event = 'attributed';

-- ---------------------------------------------------------------------------
-- Entitlements -- decision 3: two write paths, told apart by `source`
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_account_id uuid NOT NULL REFERENCES public.host_accounts (id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT 'room',
  source text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_feature_check CHECK (feature IN ('room')),
  CONSTRAINT entitlements_source_check CHECK (source IN ('stripe', 'founding', 'pilot')),
  -- The invariant that matters: a paid entitlement can only come from a
  -- payment. A bug in the admin path can grant a founding row; it cannot forge
  -- a Stripe one.
  CONSTRAINT entitlements_stripe_needs_subscription CHECK (
    (source = 'stripe' AND stripe_subscription_id IS NOT NULL)
    OR (source <> 'stripe' AND stripe_subscription_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_entitlements_host
  ON public.entitlements (host_account_id, expires_at DESC);

-- ---------------------------------------------------------------------------
-- Rooms reach missions and campaigns
-- ---------------------------------------------------------------------------

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS room_id uuid
  REFERENCES public.rooms (id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS room_id uuid
  REFERENCES public.rooms (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missions_room ON public.missions (room_id)
  WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_room ON public.campaigns (room_id)
  WHERE room_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Locks
-- ---------------------------------------------------------------------------

ALTER TABLE public.host_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_handle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_home_coach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.host_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rooms FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.room_handle_history FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.room_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.room_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.athlete_home_coach FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.referral_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.entitlements FROM PUBLIC, anon, authenticated;
