import { useEffect, useState } from 'react';
import { GLOBAL_PRESENCE_CHANNEL } from '@/lib/realtime/globalPresenceChannel';
import { supabase } from '@/lib/supabase';

/** Live set of user ids currently tracked on the global presence channel.
 * Presence keys are user ids (see useGlobalPresenceBroadcast), so the
 * channel's own state is already the online-id set. */
export function useOnlineUserIds(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL);

    function syncFromChannel() {
      setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
    }

    channel
      .on('presence', { event: 'sync' }, syncFromChannel)
      .on('presence', { event: 'join' }, syncFromChannel)
      .on('presence', { event: 'leave' }, syncFromChannel)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUserIds;
}
