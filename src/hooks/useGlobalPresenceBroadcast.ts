import { useEffect } from 'react';
import { startGlobalPresenceBroadcast } from '@/lib/realtime/globalPresenceChannel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/** Marks the current user as "online" on the shared presence channel for as
 * long as they're signed in and have a tab open. Mounted once, app-wide. */
export function useGlobalPresenceBroadcast() {
  const { user, isAuthenticated } = useAmrapAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }

    return startGlobalPresenceBroadcast(userId);
  }, [isAuthenticated, userId]);
}
