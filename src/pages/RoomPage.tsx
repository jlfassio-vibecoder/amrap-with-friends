import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { getRoomByHandle, joinRoom, type RoomPage as RoomPageData } from '@/lib/api/rooms';
import { homeCoachNotice } from '@/lib/rooms/homeCoach';
import { isRoomHost } from '@/lib/rooms/membership';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * A coach's room at `/@handle`.
 *
 * Readable signed out -- the whole point of a room address is that it can be
 * posted anywhere and open for anyone. Joining needs an account; reading does
 * not.
 *
 * The page's job, in this order: who am I training with, what can I do next,
 * why come back. Phase 2a answers the first and starts the second; next
 * mission, the workout collection and the activity list follow.
 */
/** The shape the database enforces, checked before asking it anything. */
const HANDLE = /^[a-z0-9][a-z0-9_]{2,23}$/;

export default function RoomPage() {
  const { handle: segment } = useParams<{ handle: string }>();
  const { user, isAuthenticated } = useAmrapAuth();

  // The route is `/:handle` because React Router cannot express a param with a
  // literal prefix inside a segment. This is where a room address is actually
  // told apart from any other single-segment path.
  const raw = segment ?? '';
  const handle = raw.startsWith('@') ? raw.slice(1).toLowerCase() : null;

  if (handle === null || !HANDLE.test(handle)) {
    return <NotFoundPage />;
  }

  return (
    <RoomView key={`${handle}:${user?.id ?? 'anon'}`} handle={handle} signedIn={isAuthenticated} />
  );
}

function RoomView({ handle, signedIn }: { handle: string; signedIn: boolean }) {
  const [room, setRoom] = useState<RoomPageData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getRoomByHandle(handle);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setRoom(result.room);
        setStatus('ready');
      } else {
        setStatus(result.reason === 'not_found' || result.reason === 'moved' ? 'missing' : 'error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const join = useCallback(async () => {
    if (!room) {
      return;
    }
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    setJoining(true);
    const result = await joinRoom(room.id, true);
    setJoining(false);

    if (!result.ok) {
      setNotice('That did not go through. Try again in a moment.');
      return;
    }

    // The same three-outcome rule the RPC applies, so the wording matches what
    // actually happened rather than assuming the happy case.
    const outcome = result.homeCoachSet
      ? ({ action: 'set', coachUserId: room.id } as const)
      : result.homeCoachAlreadySet
        ? ({ action: 'kept', coachUserId: room.id } as const)
        : ({ action: 'none' } as const);

    setNotice(homeCoachNotice(outcome, room.displayName) ?? `You joined ${room.displayName}.`);
    setRoom({ ...room, myRole: 'member', memberCount: room.memberCount + 1 });
  }, [room, signedIn]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  if (status === 'missing' || !room) {
    return (
      <NarrowPageLayout title="Room not found" subtitle={`@${handle}`}>
        <p className="text-sm text-secondary">
          No room answers to that handle. Check the spelling, or ask your coach for their link.
        </p>
      </NarrowPageLayout>
    );
  }

  const isMember = room.myRole !== null;

  return (
    <NarrowPageLayout title={room.displayName} subtitle={`@${room.handle}`}>
      {room.intro ? <p className="text-sm">{room.intro}</p> : null}

      <p className="mt-2 text-xs text-secondary">
        {room.memberCount} {room.memberCount === 1 ? 'athlete' : 'athletes'}
        {!room.isActive ? ' · not running missions right now' : null}
      </p>

      {notice ? <p className="mt-4 text-sm text-success-text">{notice}</p> : null}

      <div className="mt-5">
        {isRoomHost(room.myRole) ? (
          <p className="text-sm text-secondary">
            This is your room. Manage it from <a href="/host">Your rooms</a>.
          </p>
        ) : isMember ? (
          <p className="text-sm text-secondary">You&rsquo;re training with this room.</p>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void join()}
            disabled={joining}
          >
            {joining ? 'Joining…' : `Join ${room.displayName}`}
          </button>
        )}
      </div>

      {!isMember ? (
        <p className="mt-3 text-xs text-secondary">
          Joining lets this coach see the missions you finish in their room. It never adds you to
          anyone&rsquo;s squad.
        </p>
      ) : null}

      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </NarrowPageLayout>
  );
}
