import { useGlobalPresenceBroadcast } from '@/hooks/useGlobalPresenceBroadcast';

/** Renders nothing — writes a 60s presence_heartbeat so Coach can see who
 * has the app open without joining presence:global. */
export function GlobalPresenceBroadcaster() {
  useGlobalPresenceBroadcast();
  return null;
}
