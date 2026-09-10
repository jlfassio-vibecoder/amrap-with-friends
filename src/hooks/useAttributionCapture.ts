import { useEffect } from 'react';
import {
  buildAttribution,
  isAttributable,
  persistAttribution,
  readStoredAttribution,
} from '@/lib/analytics/attribution';
import { track } from '@/lib/analytics/track';

/**
 * Records where this browser came from, once, on first arrival.
 *
 * Guarded by localStorage rather than by a ref: the point is one first touch
 * per visitor for the life of the browser, not one per mount. A visitor who
 * already has a stored first touch writes nothing, so a returning user
 * arriving from a different place never overwrites the channel that found
 * them.
 */
export function useAttributionCapture(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (readStoredAttribution()) {
      return;
    }

    const attribution = buildAttribution({
      referrer: document.referrer,
      search: window.location.search,
      pathname: window.location.pathname,
      host: window.location.hostname,
    });

    // Internal navigation is not an arrival. Storing it would burn the single
    // first-touch slot on our own site and permanently mask the real source.
    if (!isAttributable(attribution)) {
      return;
    }

    persistAttribution(attribution);
    track('first_touch_captured', {
      channel: attribution.channel,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      landing_path: attribution.landingPath,
    });
  }, []);
}
