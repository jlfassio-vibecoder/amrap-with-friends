-- Phase 0: analytics event pipe — write-only client-side product analytics

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  anon_id text,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.participants (id) ON DELETE SET NULL,
  route text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_event_name_length CHECK (
    length(event_name) BETWEEN 1 AND 100
  )
);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_occurred_idx
  ON public.analytics_events (event_name, occurred_at);

CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON public.analytics_events (session_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Write-only: guests (anon) and signed-in users may insert; nobody may read,
-- update, or delete through the client. Reporting queries run with the
-- service role, which bypasses RLS.
CREATE POLICY analytics_events_insert ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.analytics_events TO anon, authenticated;
