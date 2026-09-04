import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import {
  fetchCoachAnonSummary,
  fetchCoachRecentEvents,
  type CoachAnonSummary,
  type CoachEventRow,
} from '@/lib/api/coach';
import {
  formatCoachEventLabel,
  formatCoachLabel,
  truncateAnonId,
} from '@/lib/coach/formatCoachLabel';

const RECENT_EVENTS_LIMIT = 10;

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function eventCountEntries(counts: Record<string, number>): { name: string; count: number }[] {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

interface CoachAnonDossierCardProps {
  anonId: string;
  onDismiss: () => void;
}

export function CoachAnonDossierCard({ anonId, onDismiss }: CoachAnonDossierCardProps) {
  const [summary, setSummary] = useState<CoachAnonSummary | null>(null);
  const [events, setEvents] = useState<CoachEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Copilot suggestion ignored: callRpc settles RPC failures as { error } rather than reject, matching CoachOnboardingStuckTable and other coach fetches.
    Promise.all([
      fetchCoachAnonSummary(anonId),
      fetchCoachRecentEvents({ anonId, limit: RECENT_EVENTS_LIMIT }),
    ]).then(([summaryResult, eventsResult]) => {
      if (cancelled) {
        return;
      }
      if (summaryResult.error) {
        setError(summaryResult.error.message);
        setSummary(null);
        setEvents([]);
        setLoading(false);
        return;
      }
      setError(eventsResult.error?.message ?? null);
      setSummary(summaryResult.data);
      setEvents(eventsResult.data ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [anonId]);

  const countRows = summary ? eventCountEntries(summary.eventNameCounts) : [];
  const isPresenceOnly = summary != null && summary.eventCount === 0;
  const linkedLabel = summary?.linkedUserId
    ? summary.linkedNickname
      ? `Signed in as ${summary.linkedNickname}`
      : `Signed in as ${truncateAnonId(summary.linkedUserId)}`
    : 'Not signed in on this browser.';

  return (
    <div className="space-y-3 rounded-md border border-border p-3" data-testid="coach-anon-dossier">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
            Guest browser
          </h3>
          <p className="font-mono text-sm text-ink" title={anonId}>
            {truncateAnonId(anonId)}
          </p>
        </div>
        <button type="button" className="text-sm text-secondary hover:text-ink" onClick={onDismiss}>
          Dismiss
        </button>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading guest…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && summary ? (
        <>
          {isPresenceOnly ? (
            <p className="text-sm text-secondary">
              This browser is online but has no events in the last 90 days.
            </p>
          ) : null}

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-secondary">Last seen</dt>
              <dd className="font-semibold text-ink">{formatDateTime(summary.lastOccurredAt)}</dd>
            </div>
            <div>
              <dt className="text-secondary">Last route</dt>
              <dd className="font-semibold text-ink">{summary.lastRoute ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-secondary">Events (90d)</dt>
              <dd className="font-semibold text-ink">{summary.eventCount}</dd>
            </div>
            <div>
              <dt className="text-secondary">Account</dt>
              <dd className="font-semibold text-ink" title={summary.linkedUserId ?? undefined}>
                {linkedLabel}
              </dd>
            </div>
          </dl>

          {countRows.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Event counts
              </p>
              <ul className="text-sm text-ink">
                {countRows.map((row) => (
                  <li key={row.name}>
                    {formatCoachLabel(row.name)}{' '}
                    <span className="tabular-nums text-secondary">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!isPresenceOnly ? (
            <CoachDataTable
              rows={events}
              rowKey={(row) => row.id}
              emptyLabel="No recent events for this browser."
              scrollAfterRows={5}
              columns={[
                {
                  header: 'When',
                  render: (row) => new Date(row.occurredAt).toLocaleString(),
                },
                {
                  header: 'Event',
                  render: (row) => formatCoachEventLabel(row.eventName, row.props),
                },
                {
                  header: 'Route',
                  render: (row) => row.route ?? '—',
                },
              ]}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
