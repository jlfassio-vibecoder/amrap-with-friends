import { useEffect } from 'react';
import { getOrCreateAnonId } from '@/lib/analytics/identity';
import {
  anonPresenceKey,
  startGlobalPresenceBroadcast,
} from '@/lib/realtime/globalPresenceChannel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/** Marks this tab as "online" on the shared presence channel: signed-in users
 * under their auth id, guests under `anon:${amrap_anon_id}`. Mounted once,
 * app-wide. */
export function useGlobalPresenceBroadcast() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let presenceKey: string;
    if (isAuthenticated && userId) {
      presenceKey = userId;
    } else {
      const anonId = getOrCreateAnonId();
      if (!anonId) {
        return;
      }
      presenceKey = anonPresenceKey(anonId);
    }

    try {
      return startGlobalPresenceBroadcast(presenceKey);
    } catch (error) {
      console.error('Failed to start global presence broadcast', error);
      return undefined;
    }
  }, [isAuthLoading, isAuthenticated, userId]);
}
