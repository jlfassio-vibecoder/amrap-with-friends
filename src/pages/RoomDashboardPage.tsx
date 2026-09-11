import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  getRoomActivity,
  getRoomByHandle,
  listRoomMembers,
  setRoomCohost,
  type RoomActivity,
  type RoomMember,
  type RoomPage,
} from '@/lib/api/rooms';
import { capabilitiesFor } from '@/lib/rooms/membership';
import { roomActivitySentence, roomInviteUrl } from '@/lib/rooms/roomInvite';

/**
 * A host's view of their own room.
 *
 * Separate from `/coach`, which is the platform owner's area and is gated by
 * the `coach_users` allowlist. Everything here authorizes from the caller's
 * seat in this room.
 *
 * Phase 2a covers the invite, the roster with co-host controls, and the two
 * numbers a host actually needs: who finished, and who came back. Publishing,
 * scheduling and campaigns follow.
 */
export default function RoomDashboardPage() {
  const { handle } = useParams<{ handle: string }>();
  const { user } = useAmrapAuth();
  return (
    <Dashboard
      key={`${handle ?? ''}:${user?.id ?? 'anon'}`}
      handle={(handle ?? '').toLowerCase()}
    />
  );
}

function Dashboard({ handle }: { handle: string }) {
  const [room, setRoom] = useState<RoomPage | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [activity, setActivity] = useState<RoomActivity | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const found = await getRoomByHandle(handle);
    if (!found.ok) {
      setStatus('error');
      return;
    }
    if (!capabilitiesFor(found.room.myRole).runRoom) {
      // A member who guesses this URL gets told plainly, not shown a broken page.
      setStatus('denied');
      setRoom(found.room);
      return;
    }

    setRoom(found.room);
    const [roster, counts] = await Promise.all([
      listRoomMembers(found.room.id),
      getRoomActivity(found.room.id),
    ]);
    if (roster.ok) {
      setMembers(roster.members);
    }
    if (counts.ok) {
      setActivity(counts.activity);
    }
    setStatus('ready');
  }, [handle]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await load();
      if (cancelled) {
        return;
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function toggleCohost(member: RoomMember) {
    if (!room) {
      return;
    }
    const result = await setRoomCohost(room.id, member.userId, member.role !== 'cohost');
    if (result.ok) {
      await load();
    }
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  if (status === 'error' || !room) {
    return (
      <NarrowPageLayout title="Room not found" subtitle={`@${handle}`}>
        <p className="text-sm text-secondary">No room answers to that handle.</p>
      </NarrowPageLayout>
    );
  }

  if (status === 'denied') {
    return (
      <NarrowPageLayout title={room.displayName} subtitle={`@${room.handle}`}>
        <p className="text-sm text-secondary">
          You&rsquo;re in this room, but only its owner and co-hosts can manage it.
        </p>
      </NarrowPageLayout>
    );
  }

  const invite = roomInviteUrl(window.location.origin, room.handle);
  const canManageCohosts = capabilitiesFor(room.myRole).manageCohosts;

  return (
    <NarrowPageLayout title={room.displayName} subtitle={`@${room.handle}`}>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">This week</h2>
        <p>{activity ? roomActivitySentence(activity) : 'Loading…'}</p>
        {!room.isActive ? (
          <p className="text-xs text-accent">This room isn&rsquo;t running missions right now.</p>
        ) : null}
      </section>

      <section className="card mt-4 space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Invite</h2>
        <p className="text-secondary">
          Share this anywhere. Anyone can open it; joining is their choice at the finish.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs">{invite}</code>
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(invite).then(
                () => setCopied(true),
                () => setCopied(false)
              );
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </section>

      <section className="card mt-4 space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Athletes ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-secondary">Nobody has joined yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {member.nickname ?? 'Athlete'}
                  {member.role !== 'member' ? (
                    <span className="ml-2 text-xs uppercase text-secondary">{member.role}</span>
                  ) : null}
                </span>
                {canManageCohosts && member.role !== 'owner' ? (
                  <button
                    type="button"
                    className="btn-outline shrink-0 text-xs"
                    onClick={() => void toggleCohost(member)}
                  >
                    {member.role === 'cohost' ? 'Remove co-host' : 'Make co-host'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManageCohosts ? (
          <p className="text-xs text-secondary">
            Co-hosts can publish and run missions. They can&rsquo;t change billing or see earnings.
          </p>
        ) : null}
      </section>
    </NarrowPageLayout>
  );
}
