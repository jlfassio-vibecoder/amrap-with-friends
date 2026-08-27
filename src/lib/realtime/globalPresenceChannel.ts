import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Shared Realtime Presence channel every authenticated client joins so the
 * Coach dashboard can see who currently has the app open. Presence state is
 * ephemeral (not persisted), so this is only ever read live, never queried
 * from SQL. */
export const GLOBAL_PRESENCE_CHANNEL = 'presence:global';

type OnlineIdsListener = (ids: Set<string>) => void;

const onlineListeners = new Set<OnlineIdsListener>();
let channel: RealtimeChannel | null = null;
let channelPresenceKey: string | null = null;
let broadcastUserId: string | null = null;
let channelJoined = false;

function currentOnlineIds(): Set<string> {
  if (!channel) {
    return new Set();
  }
  return new Set(Object.keys(channel.presenceState()));
}

function emitOnlineIds() {
  const ids = currentOnlineIds();
  for (const listener of onlineListeners) {
    listener(ids);
  }
}

async function trackBroadcastUser() {
  if (!channel || !broadcastUserId || !channelJoined) {
    return;
  }
  await channel.track({ online_at: new Date().toISOString() });
  emitOnlineIds();
}

/** Creates the shared channel once, registering presence callbacks before
 * subscribe(). Later callers must not call `.on('presence')` again. */
function ensureChannel(presenceKey?: string): RealtimeChannel {
  if (channel) {
    return channel;
  }

  channelPresenceKey = presenceKey ?? null;
  channelJoined = false;
  channel = supabase.channel(
    GLOBAL_PRESENCE_CHANNEL,
    presenceKey
      ? { config: { presence: { key: presenceKey } } }
      : undefined
  );

  channel
    .on('presence', { event: 'sync' }, emitOnlineIds)
    .on('presence', { event: 'join' }, emitOnlineIds)
    .on('presence', { event: 'leave' }, emitOnlineIds)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelJoined = true;
        void trackBroadcastUser();
      }
    });

  return channel;
}

function resetChannel() {
  if (!channel) {
    return;
  }
  supabase.removeChannel(channel);
  channel = null;
  channelPresenceKey = null;
  channelJoined = false;
}

function maybeTeardownChannel() {
  if (onlineListeners.size > 0 || broadcastUserId) {
    return;
  }
  resetChannel();
}

/** App-level listeners for the online user-id set. Safe to call after the
 * shared channel has already subscribed. */
export function subscribeOnlineUserIds(listener: OnlineIdsListener): () => void {
  onlineListeners.add(listener);
  ensureChannel(broadcastUserId ?? undefined);
  listener(currentOnlineIds());

  return () => {
    onlineListeners.delete(listener);
    maybeTeardownChannel();
  };
}

/** Track the signed-in user on the shared presence channel for as long as the
 * returned disposer runs. */
export function startGlobalPresenceBroadcast(userId: string): () => void {
  broadcastUserId = userId;

  // Presence keys are fixed at channel creation. If an observer opened the
  // channel first without this user id, recreate so presenceState keys stay
  // real user ids.
  if (channel && channelPresenceKey !== userId) {
    resetChannel();
  }

  ensureChannel(userId);
  void trackBroadcastUser();

  return () => {
    if (broadcastUserId === userId) {
      broadcastUserId = null;
    }
    if (channel) {
      void channel.untrack();
    }
    maybeTeardownChannel();
  };
}
