import { useEffect, useState } from 'react';
import { fetchCoachOnlineNow } from '@/lib/api/coach';

const POLL_MS = 15_000;

type OnlineIdsListener = (ids: Set<string>) => void;

type OnlineSnapshot = {
  userIds: Set<string>;
  anonIds: Set<string>;
};

const userListeners = new Set<OnlineIdsListener>();
const anonListeners = new Set<OnlineIdsListener>();
let snapshot: OnlineSnapshot = { userIds: new Set(), anonIds: new Set() };
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function emitOnline() {
  for (const listener of userListeners) {
    listener(snapshot.userIds);
  }
  for (const listener of anonListeners) {
    listener(snapshot.anonIds);
  }
}

async function refreshOnlineNow() {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    const result = await fetchCoachOnlineNow();
    if (result.data) {
      snapshot = {
        userIds: new Set(result.data.userIds),
        anonIds: new Set(result.data.anonIds),
      };
      emitOnline();
    }
  } finally {
    inFlight = false;
  }
}

function ensurePoll() {
  if (pollTimer) {
    return;
  }
  void refreshOnlineNow();
  pollTimer = setInterval(() => {
    void refreshOnlineNow();
  }, POLL_MS);
}

function maybeStopPoll() {
  if (userListeners.size > 0 || anonListeners.size > 0) {
    return;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function subscribeOnline(
  listeners: Set<OnlineIdsListener>,
  pick: (current: OnlineSnapshot) => Set<string>,
  listener: OnlineIdsListener
): () => void {
  listeners.add(listener);
  ensurePoll();
  listener(pick(snapshot));
  return () => {
    listeners.delete(listener);
    maybeStopPoll();
  };
}

/** Live auth user ids with a presence_heartbeat in the last 90s. Coach-only. */
export function useOnlineUserIds(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => snapshot.userIds);

  useEffect(() => {
    return subscribeOnline(userListeners, (current) => current.userIds, setOnlineUserIds);
  }, []);

  return onlineUserIds;
}

/** Live guest anon ids with a presence_heartbeat in the last 90s. Coach-only. */
export function useOnlineAnonIds(): Set<string> {
  const [onlineAnonIds, setOnlineAnonIds] = useState<Set<string>>(() => snapshot.anonIds);

  useEffect(() => {
    return subscribeOnline(anonListeners, (current) => current.anonIds, setOnlineAnonIds);
  }, []);

  return onlineAnonIds;
}

export function resetCoachOnlinePollForTests() {
  userListeners.clear();
  anonListeners.clear();
  snapshot = { userIds: new Set(), anonIds: new Set() };
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  inFlight = false;
}
