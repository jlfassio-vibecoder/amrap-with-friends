import { useEffect, useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useSeo } from '@/hooks/useSeo';
import { listMyRooms, type RoomSummary } from '@/lib/api/rooms';
import { capabilitiesFor } from '@/lib/rooms/membership';

/**
 * The host dashboard shell.
 *
 * Deliberately its own route and its own sign-in gate rather than anything
 * under /coach. That area is the platform owner's, gated by the `coach_users`
 * allowlist and carrying conversion analytics for the whole product; a paying
 * host must never end up holding that role. Phase 1 establishes the separation
 * while there is almost nothing here, because it is far cheaper than
 * disentangling two dashboards later.
 *
 * Phase 2 fills this in: publish, schedule, who finished, who came back.
 */
export default function HostRoomsPage() {
  useSeo();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;

    // setState only after the await, and only if this effect still owns the
    // page -- signing out mid-request must not repopulate it.
    async function load() {
      const result = await listMyRooms();
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setRooms(result.rooms);
        setError(null);
      } else {
        setError(result.reason);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <NarrowPageLayout title="Your rooms" subtitle="Sign in required">
        <p className="text-sm text-secondary">Sign in to see the rooms you host or belong to.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => setAuthOpen(true)}>
          Sign in
        </button>
        {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
      </NarrowPageLayout>
    );
  }

  const hosted = rooms?.filter((room) => capabilitiesFor(room.role).runRoom) ?? [];
  const joined = rooms?.filter((room) => !capabilitiesFor(room.role).runRoom) ?? [];

  return (
    <NarrowPageLayout title="Your rooms" subtitle="Rooms you host and rooms you train with">
      {error ? <p className="text-sm text-accent">Could not load your rooms: {error}</p> : null}

      {rooms === null && !error ? (
        <p className="text-sm text-secondary">Loading your rooms…</p>
      ) : null}

      {rooms !== null && rooms.length === 0 ? (
        <p className="text-sm text-secondary">
          You are not in a room yet. Finish a mission in someone&rsquo;s room to join it, or apply
          to host one.
        </p>
      ) : null}

      {hosted.length > 0 ? (
        <section className="mt-2">
          <h2 className="eyebrow text-secondary">Hosting</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {hosted.map((room) => (
              <RoomRow key={room.roomId} room={room} />
            ))}
          </ul>
        </section>
      ) : null}

      {joined.length > 0 ? (
        <section className="mt-6">
          <h2 className="eyebrow text-secondary">Training with</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {joined.map((room) => (
              <RoomRow key={room.roomId} room={room} />
            ))}
          </ul>
        </section>
      ) : null}
    </NarrowPageLayout>
  );
}

function RoomRow({ room }: { room: RoomSummary }) {
  return (
    <li className="card flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate font-semibold">{room.displayName}</p>
        <p className="text-xs text-secondary">
          @{room.handle} · {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {room.role !== 'member' ? (
          <span className="text-xs uppercase text-secondary">{room.role}</span>
        ) : null}
        {/* An expired or cancelled entitlement makes a room read-only rather than gone. */}
        {!room.isActive ? <span className="text-xs text-accent">Read-only</span> : null}
      </div>
    </li>
  );
}
