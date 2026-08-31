import { useEffect, useState } from 'react';
import {
  subscribeOnlineAnonIds,
  subscribeOnlineUserIds,
} from '@/lib/realtime/globalPresenceChannel';

/** Live set of auth user ids currently tracked on the global presence channel. */
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

/** Live set of guest anon ids (no `anon:` prefix) on the global presence channel. */
export function useOnlineAnonIds(): Set<string> {
  const [onlineAnonIds, setOnlineAnonIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      return subscribeOnlineAnonIds(setOnlineAnonIds);
    } catch (error) {
      console.error('Failed to subscribe to global anon presence', error);
      return undefined;
    }
  }, []);

  return onlineAnonIds;
}
