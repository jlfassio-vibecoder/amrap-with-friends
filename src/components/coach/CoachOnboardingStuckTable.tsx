import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachSectionHeader } from '@/components/coach/CoachSectionHeader';
import {
  coachOnboardingStuckStatusLabel,
  fetchCoachOnboardingStuckList,
  type CoachOnboardingStuckRow,
} from '@/lib/api/coach';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString();
}

function formatProviders(providers: string[]): string {
  if (providers.length === 0) {
    return '—';
  }
  return providers.join(', ');
}

export function CoachOnboardingStuckTable() {
  const [users, setUsers] = useState<CoachOnboardingStuckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Copilot suggestion ignored: callRpc settles RPC failures as { error } rather than reject, matching CoachActivityCohorts and other coach fetches.
    fetchCoachOnboardingStuckList().then((result) => {
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
    <section className="space-y-3" data-testid="coach-onboarding-stuck">
      <CoachSectionHeader title="Incomplete sign-ups" />
      <div className="card space-y-3 p-4">
        {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
        {error ? <p className="text-error text-sm">{error}</p> : null}
        {!loading && !error ? (
          <CoachDataTable
            columns={[
              {
                header: 'Email',
                render: (row) => row.email,
              },
              {
                header: 'Status',
                render: (row) => coachOnboardingStuckStatusLabel(row.status),
              },
              {
                header: 'Account created',
                render: (row) => formatTimestamp(row.accountCreatedAt),
              },
              {
                header: 'Last sign-in',
                render: (row) => formatTimestamp(row.lastSignInAt),
              },
              {
                header: 'Providers',
                render: (row) => formatProviders(row.providers),
              },
            ]}
            rows={users}
            rowKey={(row) => row.userId}
            emptyLabel="Everyone who signed up has finished their profile."
            scrollAfterRows={10}
          />
        ) : null}
      </div>
    </section>
  );
}
