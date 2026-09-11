import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AddToCalendar } from '@/components/calendar/AddToCalendar';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  getRoomByHandle,
  joinRoom,
  listRoomMissions,
  type RoomMission,
  type RoomPage as RoomPageData,
} from '@/lib/api/rooms';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { RoomActivityFeed } from '@/components/rooms/RoomActivityFeed';
import { roomIcsFileName, roomMissionCalendarEvent } from '@/lib/rooms/roomCalendar';
import { nextMission, nextMissionLabel } from '@/lib/rooms/roomSchedule';
import { track } from '@/lib/analytics/track';
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

/**
 * How often the page re-checks whether the scheduled time has passed.
 *
 * Coarse on purpose. This decides only whether a save-to-calendar action is
 * still worth offering, and a mission that started thirty seconds ago is the
 * one case where being slightly late costs nothing.
 */
const CALENDAR_TICK_MS = 30_000;

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
  const [upcoming, setUpcoming] = useState<RoomMission[]>([]);
  // A schedule that failed to load is not an empty schedule. Without this, a
  // slow or failed read says "nothing on the clock" over a mission that exists.
  const [scheduleStatus, setScheduleStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Bumped when someone signs in, so the feed can claim the finishes this
  // device already owns rather than leaving them unnamed behind a new account.
  const [authNonce, setAuthNonce] = useState(0);

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
        // The schedule is a second read because the room resolves first: a
        // missing handle should 404 without waiting on a list nobody will see.
        const schedule = await listRoomMissions(result.room.id);
        if (cancelled) {
          return;
        }
        if (schedule.ok) {
          setUpcoming(schedule.upcoming);
          setScheduleStatus('ready');
        } else {
          setScheduleStatus('error');
        }
      } else {
        setStatus(result.reason === 'not_found' || result.reason === 'moved' ? 'missing' : 'error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const runJoin = useCallback(async () => {
    if (!room) {
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

    // Re-read rather than patch. Rejoining reopens the membership row that was
    // there before, keeping whatever activity_visible it held, and a hand-built
    // local room object would leave that null -- showing a "Show my name here"
    // switch ticked over a name the database is hiding. The member count is
    // the server's to say too.
    const again = await getRoomByHandle(handle);
    if (again.ok) {
      setRoom(again.room);
    } else {
      setRoom({ ...room, myRole: 'member', memberCount: room.memberCount + 1 });
    }
  }, [room, handle]);

  // The start time passes while the page is open, and nothing here reloads.
  // Without a tick, a visitor who opens the room five minutes before the
  // countdown keeps the "add to calendar" actions indefinitely -- and after
  // the mission starts those save an event for a time already gone. Only runs
  // while something is actually scheduled; a room with nothing on the clock
  // has no reason to hold a timer.
  const nextScheduledAt = nextMission(upcoming)?.scheduledAt ?? null;
  useEffect(() => {
    if (nextScheduledAt === null) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), CALENDAR_TICK_MS);
    return () => window.clearInterval(id);
  }, [nextScheduledAt]);

  const join = useCallback(() => {
    if (!signedIn) {
      // AuthModal reports back when auth settles, so the join the visitor
      // already asked for happens without a second tap. Someone who taps Join,
      // signs in, and lands back on the room having joined nothing has been
      // asked to decide twice, and the second ask is the one they walk away
      // from.
      setAuthOpen(true);
      return;
    }
    void runJoin();
  }, [signedIn, runJoin]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  // A failed request is not a missing room. Collapsing the two told a visitor
  // their coach's handle does not exist because a fetch timed out.
  if (status === 'error') {
    return (
      <NarrowPageLayout title="Can’t load this room" subtitle={`@${handle}`}>
        <p className="text-sm text-secondary">
          Something went wrong reaching this room. Refresh to try again.
        </p>
      </NarrowPageLayout>
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
  const next = scheduleStatus === 'ready' ? nextMission(upcoming) : null;
  const calendarEvent = next
    ? roomMissionCalendarEvent(
        {
          roomHandle: room.handle,
          roomDisplayName: room.displayName,
          mission: next,
          workoutName: workoutName(next.templateId),
          origin: window.location.origin,
        },
        new Date(nowMs)
      )
    : null;

  return (
    <NarrowPageLayout title={room.displayName} subtitle={`@${room.handle}`}>
      {room.intro ? <p className="text-sm">{room.intro}</p> : null}

      {room.announcement ? (
        <p className="card mt-3 bg-surface-muted p-3 text-sm">{room.announcement}</p>
      ) : null}

      <section className="card mt-4 space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Next mission</h2>
        {scheduleStatus === 'loading' ? <p className="text-secondary">Checking…</p> : null}
        {scheduleStatus === 'error' ? (
          <p className="text-secondary">
            Couldn&rsquo;t load this room&rsquo;s schedule. Refresh to try again.
          </p>
        ) : null}
        {scheduleStatus === 'ready' ? <p>{nextMissionLabel(next)}</p> : null}
        {scheduleStatus === 'ready' && next ? (
          <a className="btn-primary inline-block text-sm" href={`/mission/${next.missionId}`}>
            {next.state === 'waiting' ? 'Enter mission' : 'Join mission'}
          </a>
        ) : scheduleStatus === 'ready' ? (
          <p className="text-xs text-secondary">
            Nothing on the clock right now. Joining means you&rsquo;ll see the next one.
          </p>
        ) : null}
        {/* Only when there is a future time to save. A mission running now, or
            open with no time, would put an entry in the athlete's week for
            something already over by the time they look at it. */}
        {calendarEvent ? (
          <AddToCalendar
            event={calendarEvent}
            fileName={roomIcsFileName(room.handle)}
            onSaved={(method) =>
              track('room_mission_calendar_saved', { method }, { missionId: next!.missionId })
            }
          />
        ) : null}
      </section>

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
          <button type="button" className="btn-primary" onClick={join} disabled={joining}>
            {joining ? 'Joining…' : `Join ${room.displayName}`}
          </button>
        )}
      </div>

      <RoomActivityFeed
        roomId={room.id}
        signedIn={signedIn}
        isMember={isMember}
        activityVisible={room.myActivityVisible}
        authNonce={authNonce}
        workoutName={workoutName}
        onSignUp={() => setAuthOpen(true)}
      />

      {!isMember ? (
        <p className="mt-3 text-xs text-secondary">
          Joining puts your name on the missions you finish in this room, here on this page. You can
          turn that off any time. It never adds you to anyone&rsquo;s squad.
        </p>
      ) : null}

      {authOpen ? (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={() => {
            setAuthOpen(false);
            // Tells the feed to claim this device's own finishes. Runs whether
            // or not the join below succeeds: naming a result already on the
            // page is what the prompt promised, and it does not depend on
            // membership.
            setAuthNonce((nonce) => nonce + 1);
            void runJoin();
          }}
        />
      ) : null}
    </NarrowPageLayout>
  );
}

/** The workout's own name, when the room ran one from the library. */
function workoutName(templateId: string | null): string | undefined {
  if (!templateId) {
    return undefined;
  }
  return WORKOUT_TEMPLATES.find((template) => template.id === templateId)?.name;
}
