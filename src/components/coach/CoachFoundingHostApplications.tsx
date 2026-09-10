import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { fetchCoachRecentEvents, type CoachEventRow } from '@/lib/api/coach';

const APPLICATIONS_LIMIT = 50;
const SCROLL_AFTER_ROWS = 12;

function propString(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '—';
}

/**
 * Recent Founding Host pilot applications recorded from /creators (duplicate of
 * the mailto draft so coaches can review them without hunting Explore).
 */
export function CoachFoundingHostApplications() {
  const [rows, setRows] = useState<CoachEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachRecentEvents({
      eventName: 'founding_host_applied',
      limit: APPLICATIONS_LIMIT,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setRows(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card space-y-4 p-4">
      <p className="text-sm text-secondary">
        Submitted from the /creators apply form. Mailto still opens for the applicant; these rows
        are the coach-side copy.
      </p>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && !error ? (
        <CoachDataTable
          rows={rows}
          rowKey={(row) => row.id}
          emptyLabel="No founding host applications yet."
          scrollAfterRows={SCROLL_AFTER_ROWS}
          columns={[
            {
              header: 'When',
              render: (row) => new Date(row.occurredAt).toLocaleString(),
            },
            { header: 'Name', render: (row) => propString(row.props, 'name') },
            { header: 'Email', render: (row) => propString(row.props, 'email') },
            { header: 'Handle', render: (row) => propString(row.props, 'handle') },
            { header: 'Channel', render: (row) => propString(row.props, 'channel') },
            { header: 'Slot', render: (row) => propString(row.props, 'slot') },
          ]}
        />
      ) : null}
    </div>
  );
}
