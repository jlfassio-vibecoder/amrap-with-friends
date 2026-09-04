import { useEffect, useState } from 'react';
import { CoachAnonDossierCard } from '@/components/coach/CoachAnonDossierCard';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import {
  fetchCoachGuestList,
  fetchCoachUsersList,
  type CoachGuestListRow,
  type CoachUserListRow,
} from '@/lib/api/coach';
import {
  ACTIVITY_COHORTS,
  cohortToActivityBucketParam,
  isGuestHistoryCohort,
  type ActivityCohortId,
} from '@/lib/coach/activityCohorts';
import { truncateAnonId } from '@/lib/coach/formatCoachLabel';
import { useOnlineAnonIds, useOnlineUserIds } from '@/hooks/useOnlineUserIds';

const COHORT_FETCH_LIMIT = 200;

function isGuestCapableCohort(cohort: ActivityCohortId): boolean {
  return cohort === 'anon_now' || isGuestHistoryCohort(cohort);
}

// Copilot suggestion ignored: Active Now filtering the top-200 last-active list needs a presence-id RPC to be correct at scale; current coach_users_list cannot look up arbitrary online user ids.
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

function AnonIdButton({
  anonId,
  selected,
  onSelect,
}: {
  anonId: string;
  selected: boolean;
  onSelect: (anonId: string) => void;
}) {
  return (
    <button
      type="button"
      title={anonId}
      className={
        selected
          ? 'font-mono text-sm font-semibold text-accent hover:underline'
          : 'font-mono text-sm text-ink hover:text-accent hover:underline'
      }
      onClick={() => onSelect(anonId)}
    >
      {truncateAnonId(anonId)}
    </button>
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
  const [guests, setGuests] = useState<CoachGuestListRow[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState<string | null>(null);
  const [selectedAnonId, setSelectedAnonId] = useState<string | null>(null);
  const onlineUserIds = useOnlineUserIds();
  const onlineAnonIds = useOnlineAnonIds();

  function handleCohortChange(next: ActivityCohortId) {
    if (next === cohort) {
      return;
    }

    setCohort(next);

    if (!isGuestCapableCohort(next)) {
      setSelectedAnonId(null);
    }

    if (next === 'anon_now') {
      setLoading(false);
      setError(null);
      setUsers([]);
    } else {
      setLoading(true);
    }
  }

  function handleSelectAnon(anonId: string) {
    setSelectedAnonId((current) => (current === anonId ? null : anonId));
  }

  useEffect(() => {
    if (cohort === 'anon_now') {
      return;
    }

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

  useEffect(() => {
    if (!isGuestHistoryCohort(cohort)) {
      setGuests([]);
      setGuestsError(null);
      setGuestsLoading(false);
      return;
    }

    let cancelled = false;
    setGuestsLoading(true);
    fetchCoachGuestList({
      activityBucket: cohort,
      limit: COHORT_FETCH_LIMIT,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setGuestsLoading(false);
      if (result.error) {
        setGuestsError(result.error.message);
        setGuests([]);
        return;
      }
      setGuestsError(null);
      setGuests(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [cohort]);

  const visibleUsers =
    cohort === 'active_now' ? users.filter((user) => onlineUserIds.has(user.userId)) : users;

  const anonRows = Array.from(onlineAnonIds).map((anonId) => ({ anonId }));
  const showGuestHistory = isGuestHistoryCohort(cohort);

  return (
    <section className="space-y-3" data-testid="coach-activity-cohorts">
      <h2 className="text-lg font-semibold text-ink">Users by activity</h2>
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
              {definition.id === 'active_now' || definition.id === 'anon_now' ? (
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

        {!loading && !error && cohort === 'anon_now' ? (
          <>
            <CoachDataTable
              rows={anonRows}
              rowKey={(row) => row.anonId}
              emptyLabel="No anonymous visitors online."
              scrollAfterRows={10}
              columns={[
                {
                  header: 'Anon id',
                  render: (row) => (
                    <AnonIdButton
                      anonId={row.anonId}
                      selected={selectedAnonId === row.anonId}
                      onSelect={handleSelectAnon}
                    />
                  ),
                },
                { header: 'Type', render: () => 'Guest' },
                {
                  header: 'Online',
                  render: () => <OnlineDot online />,
                },
              ]}
            />
            {selectedAnonId ? (
              <CoachAnonDossierCard
                anonId={selectedAnonId}
                onDismiss={() => setSelectedAnonId(null)}
              />
            ) : null}
          </>
        ) : null}

        {!loading && !error && cohort !== 'anon_now' ? (
          <div className="space-y-3">
            {showGuestHistory ? (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                Accounts
              </h3>
            ) : null}
            <CoachDataTable
              rows={visibleUsers}
              rowKey={(row) => row.userId}
              emptyLabel={
                cohort === 'active_now' ? 'No one is currently active.' : 'No users in this cohort.'
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
                  header: 'Online',
                  render: (row) => <OnlineDot online={onlineUserIds.has(row.userId)} />,
                },
                { header: 'Email', render: (row) => row.email },
                { header: 'Missions', render: (row) => row.totalMissions, align: 'right' },
                { header: 'Last active', render: (row) => formatLastActive(row.lastActiveAt) },
              ]}
            />
          </div>
        ) : null}

        {showGuestHistory ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">Guests</h3>
            {guestsLoading ? <p className="text-sm text-secondary">Loading guests…</p> : null}
            {guestsError ? <p className="text-error text-sm">{guestsError}</p> : null}
            {!guestsLoading && !guestsError ? (
              <>
                <CoachDataTable
                  rows={guests}
                  rowKey={(row) => row.anonId}
                  emptyLabel="No guests in this cohort."
                  scrollAfterRows={10}
                  columns={[
                    {
                      header: 'Anon id',
                      render: (row) => (
                        <AnonIdButton
                          anonId={row.anonId}
                          selected={selectedAnonId === row.anonId}
                          onSelect={handleSelectAnon}
                        />
                      ),
                    },
                    { header: 'Type', render: () => 'Guest' },
                    {
                      header: 'Online',
                      render: (row) => <OnlineDot online={onlineAnonIds.has(row.anonId)} />,
                    },
                    {
                      header: 'Last seen',
                      render: (row) => formatLastActive(row.lastOccurredAt),
                    },
                  ]}
                />
                {selectedAnonId ? (
                  <CoachAnonDossierCard
                    anonId={selectedAnonId}
                    onDismiss={() => setSelectedAnonId(null)}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
