import { useEffect, useState } from 'react';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import {
  fetchCoachUsersList,
  type CoachUserListRow,
} from '@/lib/api/coach';
import {
  ACTIVITY_COHORTS,
  cohortToActivityBucketParam,
  type ActivityCohortId,
} from '@/lib/coach/activityCohorts';
import { useOnlineUserIds } from '@/hooks/useOnlineUserIds';

const COHORT_FETCH_LIMIT = 200;

function formatLastActive(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString();
}

function OnlineDot({ online }: { online: boolean }) {
  if (!online) {
    return null;
  }
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-success"
      aria-label="Currently active"
      title="Currently active"
    />
  );
}

interface CoachActivityCohortsProps {
  selectedUser: CoachUserListRow | null;
  onSelect: (user: CoachUserListRow | null) => void;
}

export function CoachActivityCohorts({ selectedUser, onSelect }: CoachActivityCohortsProps) {
  const [cohort, setCohort] = useState<ActivityCohortId>('all');
  const [users, setUsers] = useState<CoachUserListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onlineUserIds = useOnlineUserIds();

  function handleCohortChange(next: ActivityCohortId) {
    if (next === cohort) {
      return;
    }
    setLoading(true);
    setCohort(next);
  }

  useEffect(() => {
    let cancelled = false;
    fetchCoachUsersList({
      activityBucket: cohortToActivityBucketParam(cohort),
      limit: COHORT_FETCH_LIMIT,
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
      setUsers(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [cohort]);

  const visibleUsers =
    cohort === 'active_now'
      ? users.filter((user) => onlineUserIds.has(user.userId))
      : users;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_COHORTS.map((definition) => (
          <button
            key={definition.id}
            type="button"
            title={definition.description}
            className={
              cohort === definition.id
                ? 'btn-primary flex items-center gap-1.5 text-sm'
                : 'btn-outline flex items-center gap-1.5 text-sm'
            }
            onClick={() => handleCohortChange(definition.id)}
          >
            {definition.id === 'active_now' ? (
              <span
                className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-success"
                aria-hidden="true"
              />
            ) : null}
            {definition.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-secondary">Loading users…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && !error ? (
        <CoachDataTable
          rows={visibleUsers}
          rowKey={(row) => row.userId}
          emptyLabel={
            cohort === 'active_now'
              ? 'No one is currently active.'
              : 'No users in this cohort.'
          }
          scrollAfterRows={10}
          columns={[
            {
              header: 'User',
              render: (row) => (
                <button
                  type="button"
                  className={
                    selectedUser?.userId === row.userId
                      ? 'font-semibold text-accent hover:underline'
                      : 'font-semibold text-ink hover:text-accent hover:underline'
                  }
                  onClick={() => onSelect(row)}
                >
                  {row.nickname}
                </button>
              ),
            },
            {
              header: '',
              render: (row) => <OnlineDot online={onlineUserIds.has(row.userId)} />,
            },
            { header: 'Email', render: (row) => row.email },
            { header: 'Sessions', render: (row) => row.totalSessions, align: 'right' },
            { header: 'Last active', render: (row) => formatLastActive(row.lastActiveAt) },
          ]}
        />
      ) : null}
    </div>
  );
}
