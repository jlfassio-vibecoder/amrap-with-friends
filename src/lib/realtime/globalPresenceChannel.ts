import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Shared Realtime Presence channel so the Coach dashboard can see who
 * currently has the app open. Signed-in clients track with their auth user
 * id; guests track with `anon:${amrap_anon_id}`. Presence is ephemeral (not
 * persisted), so this is only ever read live, never queried from SQL. */
export const GLOBAL_PRESENCE_CHANNEL = 'presence:global';

export const ANON_PRESENCE_PREFIX = 'anon:';

type OnlineIdsListener = (ids: Set<string>) => void;

export type GlobalPresenceSnapshot = {
  userIds: Set<string>;
  /** Raw anon uuids without the `anon:` prefix. */
  anonIds: Set<string>;
};

const userListeners = new Set<OnlineIdsListener>();
const anonListeners = new Set<OnlineIdsListener>();
let channel: RealtimeChannel | null = null;
let channelPresenceKey: string | null = null;
let broadcastPresenceKey: string | null = null;
let channelJoined = false;

export function isAnonPresenceKey(key: string): boolean {
  return key.startsWith(ANON_PRESENCE_PREFIX);
}

export function anonPresenceKey(anonId: string): string {
  return `${ANON_PRESENCE_PREFIX}${anonId}`;
}

export function partitionPresenceKeys(keys: Iterable<string>): GlobalPresenceSnapshot {
  const userIds = new Set<string>();
  const anonIds = new Set<string>();
  for (const key of keys) {
    if (isAnonPresenceKey(key)) {
      anonIds.add(key.slice(ANON_PRESENCE_PREFIX.length));
    } else {
      userIds.add(key);
    }
  }
  return { userIds, anonIds };
}

function currentPresenceSnapshot(): GlobalPresenceSnapshot {
  if (!channel) {
    return { userIds: new Set(), anonIds: new Set() };
  }
  return partitionPresenceKeys(Object.keys(channel.presenceState()));
}

function emitPresence() {
  const snapshot = currentPresenceSnapshot();
  for (const listener of userListeners) {
    listener(snapshot.userIds);
  }
  for (const listener of anonListeners) {
    listener(snapshot.anonIds);
  }
}

async function trackBroadcastPresence() {
  if (!channel || !broadcastPresenceKey || !channelJoined) {
    return;
  }
  const kind = isAnonPresenceKey(broadcastPresenceKey) ? 'anon' : 'user';
  await channel.track({
    online_at: new Date().toISOString(),
    kind,
  });
  emitPresence();
}

/** Creates the shared channel once, registering presence callbacks before
 * subscribe(). Later callers must not call `.on('presence')` again. */
function ensureChannel(presenceKey?: string): RealtimeChannel {
  if (channel) {
    return channel;
  }

  // HMR / prior mounts can leave a subscribed channel in the Supabase client
  // while this module's `channel` ref is null. Reusing it and calling `.on()`
  // throws and can break the Coach cohorts mount.
  const existingChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
  for (const existing of existingChannels) {
    if (existing.topic.includes(GLOBAL_PRESENCE_CHANNEL)) {
      supabase.removeChannel(existing);
    }
  }

  channelPresenceKey = presenceKey ?? null;
  channelJoined = false;
  channel = supabase.channel(
    GLOBAL_PRESENCE_CHANNEL,
    presenceKey ? { config: { presence: { key: presenceKey } } } : undefined
  );

  channel
    .on('presence', { event: 'sync' }, emitPresence)
    .on('presence', { event: 'join' }, emitPresence)
    .on('presence', { event: 'leave' }, emitPresence)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelJoined = true;
        void trackBroadcastPresence();
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
  if (userListeners.size > 0 || anonListeners.size > 0 || broadcastPresenceKey) {
    return;
  }
  resetChannel();
}

function subscribeIds(
  listeners: Set<OnlineIdsListener>,
  pick: (snapshot: GlobalPresenceSnapshot) => Set<string>,
  listener: OnlineIdsListener
): () => void {
  listeners.add(listener);
  ensureChannel(broadcastPresenceKey ?? undefined);
  listener(pick(currentPresenceSnapshot()));

  return () => {
    listeners.delete(listener);
    maybeTeardownChannel();
  };
}

/** App-level listeners for signed-in user ids currently online. */
export function subscribeOnlineUserIds(listener: OnlineIdsListener): () => void {
  return subscribeIds(userListeners, (s) => s.userIds, listener);
}

/** App-level listeners for guest anon ids currently online (no `anon:` prefix). */
export function subscribeOnlineAnonIds(listener: OnlineIdsListener): () => void {
  return subscribeIds(anonListeners, (s) => s.anonIds, listener);
}

/** Track this tab on the shared presence channel for as long as the returned
 * disposer runs. Pass an auth user id or `anon:${anonId}`. */
export function startGlobalPresenceBroadcast(presenceKey: string): () => void {
  broadcastPresenceKey = presenceKey;

  // Presence keys are fixed at channel creation. If an observer opened the
  // channel first without this key, recreate so our track uses the right key.
  if (channel && channelPresenceKey !== presenceKey) {
    resetChannel();
  }

  ensureChannel(presenceKey);
  void trackBroadcastPresence();

  return () => {
    if (broadcastPresenceKey === presenceKey) {
      broadcastPresenceKey = null;
    }
    if (channel) {
      void channel.untrack();
    }
    maybeTeardownChannel();
  };
}
