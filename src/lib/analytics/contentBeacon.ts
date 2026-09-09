import type { AnalyticsEventName } from '@/lib/analytics/events';
import { getOrCreateAnonId } from '@/lib/analytics/identity';

/**
 * Analytics for the static content pages, with no supabase-js.
 *
 * track() imports the Supabase client, which would pull the whole SDK into
 * every Astro page. Those pages exist to be crawled and to load fast, so
 * shipping a client library to them would damage the exact thing they are for.
 * PostgREST accepts a plain POST, so this writes the same row shape by hand --
 * the identical trick trackBeacon() already uses because sendBeacon cannot set
 * headers.
 *
 * Same anon id as the app: getOrCreateAnonId reads the one localStorage key
 * the SPA uses, and the content pages are served from the same origin, so a
 * visitor who reads three exercise pages and then opens the app is one
 * identity rather than two. That stitch is the entire point -- without it a
 * content page cannot be credited for anything that happens later.
 */
export function sendContentEvent(
  eventName: AnalyticsEventName,
  props: Record<string, unknown> = {}
): void {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey || typeof window === 'undefined') {
      return;
    }

    const anonId = getOrCreateAnonId();
    const payload = {
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      user_id: null,
      ...(anonId ? { anon_id: anonId } : {}),
      mission_id: null,
      participant_id: null,
      route: window.location.pathname,
      props,
    };

    const endpoint = `${url}/rest/v1/analytics_events`;
    const body = JSON.stringify(payload);

    // keepalive so a click that navigates away still delivers. sendBeacon is
    // the fallback because it survives unload on browsers that cancel
    // keepalive fetches, and it cannot send the apikey as a header.
    if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body,
      }).catch(() => {
        /* analytics must never break the page it is observing */
      });
      return;
    }

    navigator.sendBeacon?.(
      `${endpoint}?apikey=${anonKey}`,
      new Blob([body], { type: 'application/json' })
    );
  } catch {
    /* analytics must never break the page it is observing */
  }
}
