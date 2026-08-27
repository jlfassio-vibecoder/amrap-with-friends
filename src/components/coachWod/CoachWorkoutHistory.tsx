import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { fetchCoachWorkoutHistory, type CoachWorkoutHistoryEntry } from '@/lib/api/coachWod';

interface CoachWorkoutHistoryProps {
  workoutId: string;
}

export function CoachWorkoutHistory({ workoutId }: CoachWorkoutHistoryProps) {
  const [entries, setEntries] = useState<CoachWorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachWorkoutHistory(workoutId).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setEntries(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  return (
    <section className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        Who's run this
      </h3>
      {loading ? <p className="text-sm text-secondary">Loading history…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}
      {!loading && !error ? (
        <CoachDataTable
          rows={entries}
          rowKey={(row) => row.sessionId}
          emptyLabel="No one has run this workout yet."
          columns={[
            { header: 'Athlete', render: (row) => row.nickname },
            { header: 'Role', render: (row) => row.role },
            { header: 'State', render: (row) => row.state },
            { header: 'Score', render: (row) => row.finalScore ?? '—', align: 'right' },
            { header: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      ) : null}
    </section>
  );
}
