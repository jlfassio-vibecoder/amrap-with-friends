import { useEffect } from 'react';
import { GLOBAL_PRESENCE_CHANNEL } from '@/lib/realtime/globalPresenceChannel';
import { supabase } from '@/lib/supabase';
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

    const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userId]);
}
