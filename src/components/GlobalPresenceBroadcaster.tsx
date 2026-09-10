import { useEffect } from 'react';
import { enforceConsentBoundary } from '@/lib/analytics/consent';
import { mountConsentBanner } from '@/lib/analytics/consentBanner';
import { useAttributionCapture } from '@/hooks/useAttributionCapture';
import { useGlobalPresenceBroadcast } from '@/hooks/useGlobalPresenceBroadcast';

/** Renders nothing — writes a 60s presence_heartbeat so Coach can see who
 * has the app open without joining presence:global, and records where this
 * browser first arrived from. */
export function GlobalPresenceBroadcaster() {
  // The same banner the content pages mount — one implementation, so the two
  // surfaces cannot drift on what the visitor was told.
  useEffect(() => {
    enforceConsentBoundary();
    mountConsentBanner();
  }, []);

  useAttributionCapture();
  useGlobalPresenceBroadcast();
  return null;
}
