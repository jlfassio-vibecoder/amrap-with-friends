import { supabase } from '@/lib/supabase';
import { getOrCreateAnonId } from '@/lib/analytics/identity';

export interface TrackContext {
  userId?: string | null;
  missionId?: string | null;
  participantId?: string | null;
}

function buildPayload(eventName: string, props: Record<string, unknown>, context: TrackContext) {
  const anonId = getOrCreateAnonId();
  return {
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    user_id: context.userId ?? null,
    ...(anonId ? { anon_id: anonId } : {}),
    mission_id: context.missionId ?? null,
    participant_id: context.participantId ?? null,
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    props,
  };
}

/** Fire-and-forget product analytics event. Never throws — a failed write should never break the feature it's observing. */
export function track(
  eventName: string,
  props: Record<string, unknown> = {},
  context: TrackContext = {}
): void {
  try {
    const payload = buildPayload(eventName, props, context);
    void supabase
      .from('analytics_events')
      .insert(payload)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error && import.meta.env.DEV) {
          console.warn(`analytics: failed to record "${eventName}"`, error.message);
        }
      });
  } catch {
    /* analytics must never break the feature it's observing */
  }
}

/**
 * Same event shape as track(), but delivered via navigator.sendBeacon so it
 * survives tab close / navigation-away — cases a normal fetch can be
 * cancelled mid-flight for. sendBeacon can't set custom headers, so this
 * bypasses supabase-js and hits PostgREST directly with the (public) anon
 * key as a query param. Because no user JWT is attached, Supabase's gateway
 * runs the insert as the `anon` role regardless of sign-in state — that's
 * fine here since analytics_events grants INSERT to both anon and
 * authenticated, and user_id is carried as an explicit column rather than
 * derived from auth.uid().
 */
export function trackBeacon(
  eventName: string,
  props: Record<string, unknown> = {},
  context: TrackContext = {}
): boolean {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
    return false;
  }
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return false;
  }

  const payload = buildPayload(eventName, props, context);
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  return navigator.sendBeacon(`${url}/rest/v1/analytics_events?apikey=${anonKey}`, blob);
}
