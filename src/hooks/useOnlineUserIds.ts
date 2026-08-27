import { useEffect, useState } from 'react';
import { subscribeOnlineUserIds } from '@/lib/realtime/globalPresenceChannel';

/** Live set of user ids currently tracked on the global presence channel.
 * Presence keys are user ids (see useGlobalPresenceBroadcast), so the
 * channel's own state is already the online-id set. */
export function useOnlineUserIds(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      return subscribeOnlineUserIds(setOnlineUserIds);
    } catch (error) {
      console.error('Failed to subscribe to global presence', error);
      return undefined;
    }
  }, []);

  return onlineUserIds;
}
