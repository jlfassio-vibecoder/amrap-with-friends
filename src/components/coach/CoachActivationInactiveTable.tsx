import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachSectionHeader } from '@/components/coach/CoachSectionHeader';
import { fetchCoachActivationInactiveList, type CoachActivationInactiveRow } from '@/lib/api/coach';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString();
}

export function CoachActivationInactiveTable() {
  const [users, setUsers] = useState<CoachActivationInactiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachActivationInactiveList().then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setUsers(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-3" data-testid="coach-activation-inactive">
      <CoachSectionHeader title="Profile complete, no finished mission" />
      <div className="card space-y-3 p-4">
        {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
        {error ? <p className="text-error text-sm">{error}</p> : null}
        {!loading && !error ? (
          <CoachDataTable
            columns={[
              { header: 'Name', render: (row) => row.nickname },
              { header: 'Username', render: (row) => row.username },
              { header: 'Email', render: (row) => row.email || '—' },
              {
                header: 'Missions touched',
                render: (row) => row.missionsTouched,
                align: 'right',
              },
              {
                header: 'Account created',
                render: (row) => formatTimestamp(row.accountCreatedAt),
              },
              {
                header: 'Last sign-in',
                render: (row) => formatTimestamp(row.lastSignInAt),
              },
            ]}
            rows={users}
            rowKey={(row) => row.userId}
            emptyLabel="Every complete profile has finished at least one mission."
          />
        ) : null}
        <p className="text-xs text-secondary">
          Identity is done (username + nickname) but they have never locked a score. Missions
          touched can be zero or waiting-room only.
        </p>
      </div>
    </section>
  );
}
