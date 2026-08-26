import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { fetchCoachRecentEvents, type CoachEventRow } from '@/lib/api/coach';

const KNOWN_EVENT_NAMES = [
  'session_created',
  'session_joined',
  'template_selected',
  'audio_unlock_result',
  'session_abandoned',
  'claim_prompt_shown',
  'claim_completed',
  'claim_conflict',
  'rally_link_copied',
  'lobby_countdown_started',
  'lobby_countdown_canceled',
  'practice_started',
  'practice_finished',
  'intake_submitted',
  'intake_abandoned',
  'rpc_call',
  'realtime_status',
  'realtime_correction',
] as const;

const RECENT_EVENTS_LIMIT = 100;

export function CoachEventsExplorer() {
  const [eventName, setEventName] = useState('');
  const [rows, setRows] = useState<CoachEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachRecentEvents({ eventName: eventName || null, limit: RECENT_EVENTS_LIMIT }).then(
      (result) => {
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
      }
    );
    return () => {
      cancelled = true;
    };
  }, [eventName]);

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
          {KNOWN_EVENT_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
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
          columns={[
            {
              header: 'When',
              render: (row) => new Date(row.occurredAt).toLocaleString(),
            },
            { header: 'Event', render: (row) => row.eventName },
            {
              header: 'Session',
              render: (row) => (row.sessionId ? row.sessionId.slice(0, 8) : '—'),
            },
            {
              header: 'Anon',
              render: (row) => (row.anonId ? row.anonId.slice(0, 8) : '—'),
            },
            {
              header: 'Props',
              render: (row) => (
                <code className="text-xs text-secondary">
                  {JSON.stringify(row.props)}
                </code>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
