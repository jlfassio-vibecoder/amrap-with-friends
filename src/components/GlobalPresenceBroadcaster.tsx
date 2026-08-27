import { useGlobalPresenceBroadcast } from '@/hooks/useGlobalPresenceBroadcast';

/** Renders nothing — just keeps the current user's presence tracked for the
 * lifetime of the app so the Coach dashboard can see who's online. */
export function GlobalPresenceBroadcaster() {
  useGlobalPresenceBroadcast();
  return null;
}
