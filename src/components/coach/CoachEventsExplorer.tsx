import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { ANALYTICS_EVENT_NAMES } from '@/lib/analytics/events';
import { fetchCoachRecentEvents, type CoachEventRow } from '@/lib/api/coach';
import {
  formatCoachEventLabel,
  formatCoachLabel,
  formatCoachProps,
} from '@/lib/coach/formatCoachLabel';

// Built from the registry rather than hand-listed: a curated copy drifted ~15
// events behind what the app emits, hiding the whole auth funnel from Explore.
const FILTERABLE_EVENT_NAMES = [...ANALYTICS_EVENT_NAMES].sort();

const RECENT_EVENTS_LIMIT = 100;
const EXPLORE_SCROLL_AFTER_ROWS = 20;

interface CoachEventsExplorerProps {
  /** Scopes results to one user (via user_id or their participant rows) instead of every event. */
  userId?: string;
}

export function CoachEventsExplorer({ userId }: CoachEventsExplorerProps) {
  const [eventName, setEventName] = useState('');
  const [rows, setRows] = useState<CoachEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachRecentEvents({
      eventName: eventName || null,
      limit: RECENT_EVENTS_LIMIT,
      userId: userId ?? null,
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
  }, [eventName, userId]);

  function handleEventNameChange(next: string) {
    setEventName(next);
    setLoading(true);
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Explore recent events
        </h3>
        <select
          className="input-field w-auto text-sm"
          value={eventName}
          aria-label="Filter events by name"
          onChange={(event) => handleEventNameChange(event.target.value)}
        >
          <option value="">All events</option>
          {FILTERABLE_EVENT_NAMES.map((name) => (
            <option key={name} value={name}>
              {formatCoachLabel(name)}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && !error ? (
        <CoachDataTable
          rows={rows}
          rowKey={(row) => row.id}
          emptyLabel="No events yet."
          scrollAfterRows={EXPLORE_SCROLL_AFTER_ROWS}
          columns={[
            {
              header: 'When',
              render: (row) => new Date(row.occurredAt).toLocaleString(),
            },
            { header: 'Event', render: (row) => formatCoachEventLabel(row.eventName, row.props) },
            {
              header: 'Mission',
              render: (row) => (row.missionId ? row.missionId.slice(0, 8) : '—'),
            },
            {
              header: 'Anon',
              render: (row) => (row.anonId ? row.anonId.slice(0, 8) : '—'),
            },
            {
              header: 'Props',
              render: (row) => (
                <code className="text-xs text-secondary">{formatCoachProps(row.props)}</code>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
