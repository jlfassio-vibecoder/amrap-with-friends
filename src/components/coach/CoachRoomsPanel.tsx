import { useCallback, useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { grantRoomEntitlement, listRoomsForAdmin } from '@/lib/api/rooms';
import {
  adminRoomActionLabel,
  adminRoomState,
  adminRoomStatusLabel,
  foundingExpiry,
  type AdminRoomRow,
} from '@/lib/rooms/adminRoomStatus';

/**
 * Activating a founding host.
 *
 * `grant_room_entitlement` shipped with the boundary migration and had no
 * caller, so no host could be activated through the product. The consequence
 * was not an error message: a new host's room looked fine, then refused every
 * mission with `room_inactive` and never sent a reminder, because
 * `room_is_active` needs an entitlement that nothing could create. The first
 * real room hit that and was unblocked with a hand-written INSERT.
 *
 */
export function CoachRoomsPanel() {
  const [rows, setRows] = useState<AdminRoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyHost, setBusyHost] = useState<string | null>(null);

  function applyResult(result: Awaited<ReturnType<typeof listRoomsForAdmin>>) {
    if (result.ok) {
      // Rooms the host cannot fix themselves come first. An unactivated host is
      // blocked on us, and this screen fails at its one job if their row is
      // below the fold.
      const order = { 'never-granted': 0, expired: 1, active: 2 } as const;
      setRows(
        [...result.rooms].sort((a, b) => order[adminRoomState(a)] - order[adminRoomState(b)])
      );
      setError(null);
    } else {
      setRows([]);
      setError(result.reason);
    }
  }

  const load = useCallback(async () => {
    const result = await listRoomsForAdmin();
    applyResult(result);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRoomsForAdmin().then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function grant(row: AdminRoomRow) {
    setBusyHost(row.hostAccountId);
    const result = await grantRoomEntitlement(row.hostAccountId, 'founding', foundingExpiry());
    // Re-read rather than flip a local flag: `is_active` is computed from the
    // entitlement by the database, and a row claiming "Active" that the server
    // disagrees with is worse than a slower refresh on the one screen whose
    // job is to tell the truth about that.
    if (result.ok) {
      await load();
    } else {
      setError(result.reason ?? 'Could not grant');
    }
    setBusyHost(null);
  }

  return (
    <div className="card space-y-4 p-4">
      <p className="text-sm text-secondary">
        A room with no entitlement is read-only: it refuses every mission and sends no reminders.
        Activating grants a founding entitlement for 12 months.
      </p>

      {rows === null ? <p className="text-sm text-secondary">Loading…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {/* Never the table beside an error. A failed read sets `rows` to empty,
          and "No rooms yet." under a permission failure reads as an empty
          production database -- the one thing this screen must not imply when
          it could not see. */}
      {rows !== null && !error ? (
        <CoachDataTable
          rows={rows}
          rowKey={(row) => row.roomId}
          emptyLabel="No rooms yet."
          columns={[
            { header: 'Room', render: (row) => `@${row.handle}` },
            { header: 'Host', render: (row) => row.ownerEmail ?? '—' },
            { header: 'Members', render: (row) => String(row.memberCount) },
            {
              header: 'Status',
              render: (row) => (
                <span className={row.isActive ? undefined : 'text-error'}>
                  {adminRoomStatusLabel(row)}
                </span>
              ),
            },
            {
              header: '',
              render: (row) => {
                const label = adminRoomActionLabel(row);
                if (!label) {
                  return null;
                }
                return (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={busyHost === row.hostAccountId}
                    onClick={() => void grant(row)}
                  >
                    {busyHost === row.hostAccountId ? 'Working…' : label}
                  </button>
                );
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
