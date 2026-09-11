import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachSectionHeader } from '@/components/coach/CoachSectionHeader';
import {
  fetchCoachWaitingGraveyardList,
  type CoachDashboardWindow,
  type CoachWaitingGraveyardRow,
} from '@/lib/api/coach';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

interface CoachWaitingGraveyardTableProps {
  since: string | null;
  window: CoachDashboardWindow;
}

export function CoachWaitingGraveyardTable({ since, window }: CoachWaitingGraveyardTableProps) {
  const [missions, setMissions] = useState<CoachWaitingGraveyardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachWaitingGraveyardList({ since }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setMissions(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [since]);

  return (
    <section
      id="coach-waiting-graveyard-detail"
      className="space-y-3"
      data-testid="coach-waiting-graveyard"
    >
      <CoachSectionHeader
        title={
          window === 'all'
            ? 'Missions waiting over 2 hours'
            : `Missions waiting over 2 hours · ${window}`
        }
      />
      <div className="card space-y-3 p-4">
        {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
        {error ? <p className="text-error text-sm">{error}</p> : null}
        {!loading && !error ? (
          <CoachDataTable
            columns={[
              { header: 'Workout', render: (row) => row.workoutName },
              { header: 'State', render: (row) => row.state },
              { header: 'Created', render: (row) => formatTimestamp(row.createdAt) },
              {
                header: 'Age (h)',
                render: (row) => row.ageHours,
                align: 'right',
              },
            ]}
            rows={missions}
            rowKey={(row) => row.missionId}
            emptyLabel="No waiting missions older than 2 hours."
          />
        ) : null}
      </div>
    </section>
  );
}
