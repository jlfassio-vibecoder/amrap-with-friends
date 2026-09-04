import { useEffect } from 'react';
import { getOrCreateAnonId } from '@/lib/analytics/identity';
import { track } from '@/lib/analytics/track';
import { isLinkableAnonId } from '@/lib/api/linkAnonIdentity';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

const HEARTBEAT_MS = 60_000;

/**
 * Marks this tab as online via a 60s analytics heartbeat.
 * Supabase Presence cannot track without joining the topic, and joining
 * delivers the full roster (auth uuids + anon ids) to every subscriber.
 * Coach reads the last 90s of presence_heartbeat through coach_online_now.
 */
export function useGlobalPresenceBroadcast() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const signedIn = Boolean(isAuthenticated && userId);
    if (!signedIn && !isLinkableAnonId(getOrCreateAnonId())) {
      return;
    }

    const heartbeatUserId = signedIn ? userId : null;

    function fireHeartbeat() {
      track('presence_heartbeat', {}, { userId: heartbeatUserId });
    }

    fireHeartbeat();
    const intervalId = window.setInterval(fireHeartbeat, HEARTBEAT_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fireHeartbeat();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthLoading, isAuthenticated, userId]);
}
