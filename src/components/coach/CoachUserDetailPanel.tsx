import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachEventsExplorer } from '@/components/coach/CoachEventsExplorer';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { fetchCoachUserDetail, type CoachUserDetail } from '@/lib/api/coach';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function CoachUserDetailPanel({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<CoachUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachUserDetail(userId).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setDetail(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-secondary">Loading user…</p>;
  }
  if (error) {
    return <p className="text-error text-sm">{error}</p>;
  }
  if (!detail) {
    return null;
  }

  const { profile, summary, sessions, classificationHistory } = detail;

  return (
    <div className="space-y-8">
      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-semibold text-ink">{profile.nickname}</h2>
        <p className="text-sm text-secondary">
          @{profile.username} · {profile.email}
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-secondary">
          <span>
            Rank:{' '}
            <span className="font-semibold text-ink">{profile.perceivedClassification}</span>
          </span>
          <span>Sex: {profile.biologicalSex ?? '—'}</span>
          <span>Height: {profile.heightCm ?? '—'} cm</span>
          <span>Weight: {profile.weightKg ?? '—'} kg</span>
          <span>Account created: {formatDate(profile.accountCreatedAt)}</span>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Frequency
        </h3>
        <CoachStatGrid
          stats={[
            { label: 'Total sessions', value: summary.totalSessions },
            { label: 'As host', value: summary.sessionsAsHost },
            { label: 'As joiner', value: summary.sessionsAsJoiner },
            { label: 'Practice sessions', value: summary.practiceSessionsStarted },
          ]}
        />
        <p className="text-sm text-secondary">
          First seen: {formatDate(summary.firstSeenAt)} · Last active:{' '}
          {formatDate(summary.lastActiveAt)}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Workouts
        </h3>
        <div className="card p-4">
          <CoachDataTable
            rows={sessions}
            rowKey={(row) => row.sessionId}
            emptyLabel="No sessions yet."
            columns={[
              { header: 'Template', render: (row) => row.templateId ?? 'Custom' },
              { header: 'Role', render: (row) => row.role },
              { header: 'Duration', render: (row) => `${row.durationMinutes}m`, align: 'right' },
              { header: 'State', render: (row) => row.state },
              { header: 'Score', render: (row) => row.finalScore ?? '—', align: 'right' },
              { header: 'When', render: (row) => formatDateTime(row.joinedAt) },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Classification history
        </h3>
        <div className="card p-4">
          <CoachDataTable
            rows={classificationHistory}
            rowKey={(row) => `${row.kind}-${row.occurredAt}`}
            emptyLabel="No classification changes recorded."
            columns={[
              { header: 'Kind', render: (row) => row.kind },
              { header: 'From', render: (row) => row.previousValue ?? '—' },
              { header: 'To', render: (row) => row.newValue },
              { header: 'When', render: (row) => formatDateTime(row.occurredAt) },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Support: recent activity
        </h3>
        <CoachEventsExplorer key={userId} userId={userId} />
      </section>
    </div>
  );
}
