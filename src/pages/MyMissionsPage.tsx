import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatModifiedBadge } from '@/lib/mission/modifiedMovements';
import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import { AppLink } from '@/components/AppLink';
import { Link, useNavigate } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { MyMissionScoreBreakdownModal } from '@/components/MyMissionScoreBreakdownModal';
import { AssignedWorkoutsPanel } from '@/components/mission/AssignedWorkoutsPanel';
import { SendWorkoutToSquad } from '@/components/mission/SendWorkoutToSquad';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import { ScalingProgressionPanel } from '@/components/mission/ScalingProgressionPanel';
import { CheckInProgressionPanel } from '@/components/mission/CheckInProgressionPanel';
import { MyMissionsTabPanel } from '@/components/mission/MyMissionsTabPanel';
import { MyMissionsTopTabs } from '@/components/mission/MyMissionsTopTabs';
import type { MyMissionsTabKey } from '@/components/mission/myMissionsTabIds';
import { MyMissionCheckIn } from '@/components/mission/MyMissionCheckIn';
import { fetchMyBenchmarks, retireBenchmark, type AthleteBenchmark } from '@/lib/api/benchmarks';
import { benchmarkForMission } from '@/lib/benchmark/matchBenchmark';
import {
  applyMyMissionDetail,
  canDeleteMyMission,
  deleteIncompleteMission,
  fetchMyMissionDetail,
  fetchMyMissions,
  formatMyMissionExerciseLine,
  formatMyMissionScoreDisplay,
  formatMyMissionShareText,
  myMissionWorkoutTitle,
  type MyMissionEntry,
} from '@/lib/api/myMissions';
import type { MissionChainItem } from '@/lib/api/missionChain';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { fetchHostActiveMissionCount } from '@/lib/api/missions';
import { createRallyPointMission } from '@/lib/api/rallyPoint';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useCopyFlash } from '@/hooks/useCopyFlash';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { formatMissionStateLabel } from '@/lib/mission/formatMissionStateLabel';
import { myMissionListCtaLabel } from '@/lib/mission/hostMissionListCta';
import { groupMyMissionsByRallyPoint } from '@/lib/mission/groupMyMissionsByRallyPoint';
import { HOST_ACTIVE_MISSION_LIMIT } from '@/lib/mission/rallySchedule';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

function formatMissionWhen(entry: MyMissionEntry): string {
  const when = entry.scheduledAt ?? entry.createdAt;
  return new Date(when).toLocaleString();
}

function confirmDeleteMessage(entry: MyMissionEntry): string {
  if (entry.isFeatured) {
    return "Cancel today's mission for this date and time only? Other scheduled days stay on the calendar.";
  }
  return 'Permanently delete this incomplete mission?';
}

function needsMissionDetail(entry: MyMissionEntry): boolean {
  if (entry.workout.length === 0 && entry.movementCount > 0) {
    return true;
  }
  return entry.hasScoreBreakdown && entry.scoreBreakdown === null;
}

/** Keep client-hydrated workout/breakdown when the slim list refetches. */
function mergePreservingHydration(
  previous: MyMissionEntry[],
  next: MyMissionEntry[]
): MyMissionEntry[] {
  const prevById = new Map(previous.map((entry) => [entry.missionId, entry]));
  return next.map((entry) => {
    const prior = prevById.get(entry.missionId);
    if (!prior) {
      return entry;
    }
    const workout = prior.workout.length > 0 ? prior.workout : entry.workout;
    const scoreBreakdown = prior.scoreBreakdown ?? entry.scoreBreakdown;
    const intensityTier = prior.intensityTier ?? entry.intensityTier;
    if (
      workout === entry.workout &&
      scoreBreakdown === entry.scoreBreakdown &&
      intensityTier === entry.intensityTier
    ) {
      return entry;
    }
    return {
      ...entry,
      workout,
      movementCount: workout.length > 0 ? workout.length : entry.movementCount,
      intensityTier,
      scoreBreakdown,
      hasScoreBreakdown: entry.hasScoreBreakdown || scoreBreakdown !== null,
    };
  });
}

function MyMissionMovements({
  title,
  workout,
  movementCount,
  onExpand,
}: {
  title: string;
  workout: WorkoutExercise[];
  movementCount: number;
  onExpand?: () => void;
}) {
  const count = workout.length > 0 ? workout.length : movementCount;
  if (count === 0) {
    return <p className="text-display text-lg text-ink">{title}</p>;
  }

  const summary = count === 1 ? '1 movement' : `${count} movements`;

  return (
    <details
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) {
          onExpand?.();
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-x-3 [&::-webkit-details-marker]:hidden">
        <span className="text-display text-lg text-ink">{title}</span>
        <span className="ml-auto inline-flex items-baseline gap-1 text-sm text-secondary hover:text-ink">
          <span aria-hidden="true" className="text-[0.75em] leading-none">
            ▼
          </span>
          {summary}
        </span>
      </summary>
      {workout.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-secondary">
          {workout.map((exercise, index) => (
            <li key={`${exercise.name}-${index}`}>{formatMyMissionExerciseLine(exercise)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-secondary">Loading movements…</p>
      )}
    </details>
  );
}

function ShareMyMissionButton({
  entry,
  ensureDetail,
}: {
  entry: MyMissionEntry;
  ensureDetail: (entry: MyMissionEntry) => Promise<MyMissionEntry | null>;
}) {
  const { copied, error, copy } = useCopyFlash();

  async function handleShare() {
    const hydrated = (await ensureDetail(entry)) ?? entry;
    const text = formatMyMissionShareText(hydrated);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }
    await copy(text, 'Could not copy. Select and copy the mission summary manually.');
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className="link-accent" onClick={() => void handleShare()}>
        {copied ? 'Copied' : 'Share'}
      </button>
      {error ? <span className="text-error text-xs">{error}</span> : null}
    </span>
  );
}

function QueuedMissionCard({ item }: { item: MissionChainItem }) {
  const title = resolveWorkoutTitle(item.templateId);

  return (
    <div className="card space-y-2 p-4 text-sm">
      <MyMissionMovements
        title={title}
        workout={item.workout}
        movementCount={item.workout.length}
      />
      <p className="text-center text-secondary">{item.durationMinutes} min · queued</p>
    </div>
  );
}

function MyMissionCard({
  entry,
  deletingMissionId,
  relaunchingMissionId,
  profileLoading,
  onDelete,
  onRelaunch,
  onViewBreakdown,
  ensureDetail,
  benchmark,
  onRetireBenchmark,
  expandControl,
}: {
  entry: MyMissionEntry;
  deletingMissionId: string | null;
  relaunchingMissionId: string | null;
  profileLoading: boolean;
  onDelete: (entry: MyMissionEntry) => void;
  onRelaunch: (entry: MyMissionEntry) => void;
  onViewBreakdown: (entry: MyMissionEntry) => void;
  ensureDetail: (entry: MyMissionEntry) => Promise<MyMissionEntry | null>;
  /** The benchmark this workout and clock belong to, live or retired. */
  benchmark?: AthleteBenchmark | null;
  onRetireBenchmark?: (benchmarkId: string) => void;
  expandControl?: {
    expanded: boolean;
    missionCount: number;
    /** 1-based position of this card in the chain (parent is always 1). */
    position: number;
    onToggle: () => void;
  };
}) {
  // Prefer what the athlete actually named — "Diamond Push-ups: from the knees"
  // — and fall back to the plain mark when no named option was chosen.
  const modifiedBadge =
    formatVariantBadge(entry.movementVariants) ?? formatModifiedBadge(entry.modifiedMovements);
  const relaunching = relaunchingMissionId === entry.missionId;
  const relaunchBusy = relaunchingMissionId != null || profileLoading;
  return (
    <div className="card space-y-2 p-4 text-sm">
      <MyMissionMovements
        title={myMissionWorkoutTitle(entry)}
        workout={entry.workout}
        movementCount={entry.movementCount}
        onExpand={() => {
          if (needsMissionDetail(entry)) {
            void ensureDetail(entry);
          }
        }}
      />
      <p className="text-center text-secondary">
        {formatMissionWhen(entry)} · {entry.durationMinutes} min ·{' '}
        {formatMyMissionScoreDisplay(entry)} · {formatMissionStateLabel(entry.state)}
        {modifiedBadge ? (
          <>
            {' · '}
            <span title={modifiedBadge}>Modified</span>
          </>
        ) : null}
        {entry.isFeatured ? ' · Featured' : ''}
      </p>
      {benchmark ? (
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={
              benchmark.retiredAt === null
                ? 'rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent'
                : 'rounded-full border border-border px-2 py-0.5 text-xs text-secondary'
            }
          >
            {benchmark.retiredAt === null ? 'Benchmark' : 'Benchmark · retired'}
          </span>
          {benchmark.retiredAt === null && onRetireBenchmark ? (
            <button
              type="button"
              className="link-accent text-xs"
              onClick={() => onRetireBenchmark(benchmark.id)}
            >
              Retire
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {entry.hasScoreBreakdown ? (
          <button
            type="button"
            className="link-accent"
            onClick={() => {
              void (async () => {
                const hydrated = (await ensureDetail(entry)) ?? entry;
                onViewBreakdown(hydrated);
              })();
            }}
          >
            View breakdown
          </button>
        ) : null}
        <ShareMyMissionButton entry={entry} ensureDetail={ensureDetail} />
        <SendWorkoutToSquad
          durationMinutes={entry.durationMinutes}
          workout={entry.workout}
          templateId={entry.templateId}
          ready={entry.movementCount > 0 || entry.workout.length > 0}
          ensureWorkout={async () => {
            const hydrated = await ensureDetail(entry);
            return hydrated?.workout ?? null;
          }}
          triggerClassName="link-accent font-normal disabled:text-muted"
          triggerLabel="Add squad member"
        />
        {expandControl ? (
          <button
            type="button"
            className="link-accent inline-flex items-center gap-1 font-semibold"
            aria-expanded={expandControl.expanded}
            aria-label={expandControl.expanded ? 'Hide chained missions' : 'Show chained missions'}
            onClick={expandControl.onToggle}
          >
            <span aria-hidden="true">{expandControl.expanded ? '▲' : '▼'}</span>
            {expandControl.position} of {expandControl.missionCount} in this chain
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-teal" to={`/mission/${entry.missionId}`}>
          {myMissionListCtaLabel(entry.state, entry.role)}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {!canDeleteMyMission(entry) ? (
            <button
              type="button"
              className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm font-semibold leading-tight text-on-accent hover:bg-accent-hover disabled:opacity-50"
              disabled={relaunchBusy}
              onClick={() => onRelaunch(entry)}
            >
              {relaunching ? 'Launching…' : 'Re-launch mission'}
            </button>
          ) : null}
          {canDeleteMyMission(entry) ? (
            <button
              type="button"
              className="text-error"
              disabled={deletingMissionId === entry.missionId}
              onClick={() => onDelete(entry)}
            >
              {deletingMissionId === entry.missionId ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>
      <MyMissionCheckIn
        rpe={entry.rpe}
        sessionNotes={entry.sessionNotes}
        checkIns={entry.checkIns}
      />
    </div>
  );
}

export default function MyMissionsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { profile, loading: profileLoading, error: profileError } = useAthleteProfile();
  const [entries, setEntries] = useState<MyMissionEntry[]>([]);
  const [chainsByRallyPointId, setChainsByRallyPointId] = useState<
    Record<string, MissionChainItem[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [breakdownEntry, setBreakdownEntry] = useState<MyMissionEntry | null>(null);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const [relaunchingMissionId, setRelaunchingMissionId] = useState<string | null>(null);
  const [expandedRallyPointIds, setExpandedRallyPointIds] = useState<Set<string>>(() => new Set());
  const [benchmarks, setBenchmarks] = useState<AthleteBenchmark[]>([]);
  const [activeTab, setActiveTab] = useState<MyMissionsTabKey>('missions');

  const listItems = useMemo(
    () => groupMyMissionsByRallyPoint(entries, chainsByRallyPointId),
    [entries, chainsByRallyPointId]
  );

  const loadBenchmarks = useCallback(async () => {
    const result = await fetchMyBenchmarks();
    if (!result.error) {
      setBenchmarks(result.data ?? []);
    }
  }, []);

  const loadMissions = useCallback(
    async (options?: { preserveHydration?: boolean; isCancelled?: () => boolean }) => {
      const result = await fetchMyMissions();
      if (options?.isCancelled?.()) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
        setEntries([]);
        setChainsByRallyPointId({});
      } else {
        const next = result.data ?? [];
        if (options?.preserveHydration) {
          setEntries((prev) => mergePreservingHydration(prev, next));
        } else {
          setEntries(next);
        }
        setChainsByRallyPointId(result.chains);
      }
      setHasLoaded(true);
    },
    []
  );

  const ensureDetail = useCallback(
    async (
      entry: MyMissionEntry,
      options?: { force?: boolean }
    ): Promise<MyMissionEntry | null> => {
      if (!options?.force && !needsMissionDetail(entry)) {
        return entry;
      }

      const result = await fetchMyMissionDetail(entry.missionId);
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Could not load mission details.');
        return null;
      }

      const merged = applyMyMissionDetail(entry, result.data);
      setEntries((prev) =>
        prev.map((item) => (item.missionId === merged.missionId ? merged : item))
      );
      setBreakdownEntry((current) => (current?.missionId === merged.missionId ? merged : current));
      return merged;
    },
    []
  );

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadBenchmarks();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, loadBenchmarks]);

  async function handleRetireBenchmark(benchmarkId: string) {
    const result = await retireBenchmark(benchmarkId);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await loadBenchmarks();
  }

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;
    void loadMissions({ isCancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user, loadMissions]);

  const refetchOnVisible = useCallback(() => {
    void loadMissions({ preserveHydration: true });
    void loadBenchmarks();
  }, [loadMissions, loadBenchmarks]);

  useRefetchOnVisible(Boolean(isAuthenticated && user && !isAuthLoading), refetchOnVisible);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

  async function handleDelete(entry: MyMissionEntry) {
    if (!canDeleteMyMission(entry) || deletingMissionId) {
      return;
    }
    const confirmed = window.confirm(confirmDeleteMessage(entry));
    if (!confirmed) {
      return;
    }

    setDeletingMissionId(entry.missionId);
    setError(null);
    try {
      const result = await deleteIncompleteMission(entry.missionId);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      await loadMissions();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeletingMissionId(null);
    }
  }

  async function handleRelaunch(entry: MyMissionEntry) {
    if (relaunchingMissionId || profileLoading) {
      return;
    }

    if (profileError) {
      setError(profileError);
      return;
    }

    const nickname = profile?.nickname?.trim() ?? '';
    if (!nickname) {
      setError('Add your name in Your profile before launching.');
      return;
    }

    setRelaunchingMissionId(entry.missionId);
    setError(null);
    try {
      const activeCount = await fetchHostActiveMissionCount();
      if (activeCount.error) {
        setError(activeCount.error.message);
        return;
      }
      if ((activeCount.data ?? 0) >= HOST_ACTIVE_MISSION_LIMIT) {
        setError(`You already have ${HOST_ACTIVE_MISSION_LIMIT} active missions.`);
        return;
      }

      const hydrated = (await ensureDetail(entry, { force: true })) ?? entry;
      if (hydrated.workout.length === 0) {
        setError('Could not load this workout to re-launch.');
        return;
      }

      // Prefer the mission's stored tier (coach / AMQAP / custom); library lookup is fallback.
      const intensityTier =
        hydrated.intensityTier ??
        (hydrated.templateId
          ? (WORKOUT_TEMPLATES.find((template) => template.id === hydrated.templateId)
              ?.intensityTier ?? null)
          : null);

      const result = await createRallyPointMission({
        nickname,
        durationMinutes: hydrated.durationMinutes,
        workout: hydrated.workout,
        templateId: hydrated.templateId,
        intensityTier,
      });
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      navigate(`/mission/${result.data.missionId}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setRelaunchingMissionId(null);
    }
  }

  function toggleGroup(rallyPointId: string) {
    setExpandedRallyPointIds((current) => {
      const next = new Set(current);
      if (next.has(rallyPointId)) {
        next.delete(rallyPointId);
      } else {
        next.add(rallyPointId);
      }
      return next;
    });
  }

  return (
    <NarrowPageLayout
      title="My missions"
      subtitle="Saved to your account"
      desktopTitleAsPageHeading
      contentMaxWidthClassName="max-w-5xl"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-primary" to="/create">
          Plan mission
        </Link>
        <Link className="btn-primary" to="/campaign/new">
          New campaign
        </Link>
      </div>

      <div className="space-y-4">
        <MyMissionsTopTabs activeTab={activeTab} onChange={setActiveTab} />

        <MyMissionsTabPanel tab="missions" activeTab={activeTab}>
          {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

          {error ? <p className="text-error">Error: {error}</p> : null}

          {!loading && isAuthenticated && entries.length === 0 ? (
            <p className="text-sm text-secondary">
              No saved missions yet. Finish a mission and use “Save this mission to my account”.
            </p>
          ) : null}

          {listItems.length > 0 ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {listItems.map((item) => {
                if (item.kind === 'single') {
                  return (
                    <li key={item.entry.participantId}>
                      <MyMissionCard
                        entry={item.entry}
                        deletingMissionId={deletingMissionId}
                        relaunchingMissionId={relaunchingMissionId}
                        profileLoading={profileLoading}
                        onDelete={(entry) => void handleDelete(entry)}
                        onRelaunch={(entry) => void handleRelaunch(entry)}
                        onViewBreakdown={setBreakdownEntry}
                        ensureDetail={ensureDetail}
                        benchmark={benchmarkForMission(item.entry, benchmarks)}
                        onRetireBenchmark={(id) => void handleRetireBenchmark(id)}
                      />
                    </li>
                  );
                }

                const expanded = expandedRallyPointIds.has(item.rallyPointId);
                return (
                  <li key={item.rallyPointId} className="space-y-2">
                    <MyMissionCard
                      entry={item.parent}
                      deletingMissionId={deletingMissionId}
                      relaunchingMissionId={relaunchingMissionId}
                      profileLoading={profileLoading}
                      onDelete={(entry) => void handleDelete(entry)}
                      onRelaunch={(entry) => void handleRelaunch(entry)}
                      onViewBreakdown={setBreakdownEntry}
                      ensureDetail={ensureDetail}
                      benchmark={benchmarkForMission(item.parent, benchmarks)}
                      onRetireBenchmark={(id) => void handleRetireBenchmark(id)}
                      expandControl={{
                        expanded,
                        missionCount: item.chainLength,
                        position: 1,
                        onToggle: () => toggleGroup(item.rallyPointId),
                      }}
                    />
                    {expanded ? (
                      <ul className="space-y-2 border-l-2 border-border pl-3">
                        {item.children.map((child) =>
                          child.kind === 'started' ? (
                            <li key={child.entry.participantId}>
                              <MyMissionCard
                                entry={child.entry}
                                deletingMissionId={deletingMissionId}
                                relaunchingMissionId={relaunchingMissionId}
                                profileLoading={profileLoading}
                                onDelete={(entry) => void handleDelete(entry)}
                                onRelaunch={(entry) => void handleRelaunch(entry)}
                                onViewBreakdown={setBreakdownEntry}
                                ensureDetail={ensureDetail}
                                benchmark={benchmarkForMission(child.entry, benchmarks)}
                                onRetireBenchmark={(id) => void handleRetireBenchmark(id)}
                              />
                            </li>
                          ) : (
                            <li key={child.chainItem.id}>
                              <QueuedMissionCard item={child.chainItem} />
                            </li>
                          )
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <ScalingProgressionPanel entries={entries} />
          <CheckInProgressionPanel entries={entries} />
        </MyMissionsTabPanel>

        <MyMissionsTabPanel tab="sent" activeTab={activeTab}>
          <AssignedWorkoutsPanel showWhenEmpty />
        </MyMissionsTabPanel>

        <MyMissionsTabPanel tab="campaigns" activeTab={activeTab}>
          <MyCampaignsPanel showCreateCta={false} />
        </MyMissionsTabPanel>
      </div>

      {breakdownEntry?.scoreBreakdown ? (
        <MyMissionScoreBreakdownModal
          entry={breakdownEntry}
          onClose={() => setBreakdownEntry(null)}
        />
      ) : null}

      <p className="text-center text-sm">
        <AppLink className="link-accent" to="/">
          Back home
        </AppLink>
      </p>
    </NarrowPageLayout>
  );
}
