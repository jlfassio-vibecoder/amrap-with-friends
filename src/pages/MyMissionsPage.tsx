import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { MyMissionScoreBreakdownModal } from '@/components/MyMissionScoreBreakdownModal';
import { AssignedWorkoutsPanel } from '@/components/mission/AssignedWorkoutsPanel';
import { SendWorkoutToSquad } from '@/components/mission/SendWorkoutToSquad';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import {
  canDeleteMyMission,
  deleteIncompleteMission,
  fetchMyMissions,
  formatMyMissionExerciseLine,
  formatMyMissionScoreDisplay,
  formatMyMissionShareText,
  myMissionWorkoutTitle,
  type MyMissionEntry,
} from '@/lib/api/myMissions';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useCopyFlash } from '@/hooks/useCopyFlash';
import { groupMyMissionsByRallyPoint } from '@/lib/mission/groupMyMissionsByRallyPoint';

function formatMissionWhen(entry: MyMissionEntry): string {
  const when = entry.scheduledAt ?? entry.createdAt;
  return new Date(when).toLocaleString();
}

function confirmDeleteMessage(entry: MyMissionEntry): string {
  if (entry.isFeatured) {
    return 'Cancel this Featured WOD for this date and time only? Other scheduled days stay on the calendar.';
  }
  return 'Permanently delete this incomplete mission?';
}

function moreMissionsLabel(count: number): string {
  return count === 1 ? '1 more mission' : `${count} more missions`;
}

function MyMissionMovements({ title, workout }: { title: string; workout: WorkoutExercise[] }) {
  if (workout.length === 0) {
    return <p className="text-display text-lg text-ink">{title}</p>;
  }

  const summary = workout.length === 1 ? '1 movement' : `${workout.length} movements`;

  return (
    <details>
      <summary className="flex cursor-pointer list-none items-baseline gap-x-3 [&::-webkit-details-marker]:hidden">
        <span className="text-display text-lg text-ink">{title}</span>
        <span className="ml-auto inline-flex items-baseline gap-1 text-sm text-secondary hover:text-ink">
          <span aria-hidden="true" className="text-[0.75em] leading-none">
            ▼
          </span>
          {summary}
        </span>
      </summary>
      <ul className="mt-2 space-y-1 text-sm text-secondary">
        {workout.map((exercise, index) => (
          <li key={`${exercise.name}-${index}`}>{formatMyMissionExerciseLine(exercise)}</li>
        ))}
      </ul>
    </details>
  );
}

function ShareMyMissionButton({ entry }: { entry: MyMissionEntry }) {
  const { copied, error, copy } = useCopyFlash();

  async function handleShare() {
    const text = formatMyMissionShareText(entry);
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

function MyMissionCard({
  entry,
  deletingMissionId,
  onDelete,
  onViewBreakdown,
  expandControl,
}: {
  entry: MyMissionEntry;
  deletingMissionId: string | null;
  onDelete: (entry: MyMissionEntry) => void;
  onViewBreakdown: (entry: MyMissionEntry) => void;
  expandControl?: {
    expanded: boolean;
    childCount: number;
    onToggle: () => void;
  };
}) {
  return (
    <div className="card space-y-2 p-4 text-sm">
      <MyMissionMovements title={myMissionWorkoutTitle(entry)} workout={entry.workout} />
      <p className="text-center text-secondary">
        {formatMissionWhen(entry)} · {entry.durationMinutes} min ·{' '}
        {formatMyMissionScoreDisplay(entry)} · {entry.state}
        {entry.isFeatured ? ' · Featured' : ''}
      </p>
      {expandControl ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="link-accent text-sm"
            aria-expanded={expandControl.expanded}
            onClick={expandControl.onToggle}
          >
            {expandControl.expanded
              ? 'Hide linked missions'
              : moreMissionsLabel(expandControl.childCount)}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link className="link-accent" to={`/mission/${entry.missionId}`}>
          View mission
        </Link>
        {entry.scoreBreakdown ? (
          <button type="button" className="link-accent" onClick={() => onViewBreakdown(entry)}>
            View breakdown
          </button>
        ) : null}
        <ShareMyMissionButton entry={entry} />
        <SendWorkoutToSquad
          durationMinutes={entry.durationMinutes}
          workout={entry.workout}
          templateId={entry.templateId}
          ready={entry.workout.length > 0}
          triggerClassName="link-accent font-normal disabled:text-muted"
          triggerLabel="Add squad member"
        />
        {canDeleteMyMission(entry) ? (
          <button
            type="button"
            className="text-error ml-auto"
            disabled={deletingMissionId === entry.missionId}
            onClick={() => onDelete(entry)}
          >
            {deletingMissionId === entry.missionId ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function MyMissionsPage() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [entries, setEntries] = useState<MyMissionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [breakdownEntry, setBreakdownEntry] = useState<MyMissionEntry | null>(null);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const [expandedRallyPointIds, setExpandedRallyPointIds] = useState<Set<string>>(() => new Set());

  const listItems = useMemo(() => groupMyMissionsByRallyPoint(entries), [entries]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchMyMissions().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
      } else {
        setEntries(result.data ?? []);
      }
      setHasLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user]);

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
      setEntries((prev) => prev.filter((item) => item.missionId !== entry.missionId));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeletingMissionId(null);
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
    <NarrowPageLayout title="My missions" subtitle="Saved to your account">
      <p className="text-sm text-secondary lg:hidden">Missions you saved to your account.</p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">My missions</h1>
        <p className="text-sm text-secondary">Missions you saved to your account.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-primary" to="/create">
          Create mission
        </Link>
        <Link className="btn-primary" to="/campaign/new">
          New campaign
        </Link>
      </div>

      <AssignedWorkoutsPanel />

      <MyCampaignsPanel showCreateCta={false} />

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-secondary">Sign in to see missions saved to your account.</p>
      ) : null}

      {error && <p className="text-error">Error: {error}</p>}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-secondary">
          No saved missions yet. Finish a mission and use “Save this mission to my account”.
        </p>
      ) : null}

      {listItems.length > 0 && (
        <ul className="space-y-3">
          {listItems.map((item) => {
            if (item.kind === 'single') {
              return (
                <li key={item.entry.participantId}>
                  <MyMissionCard
                    entry={item.entry}
                    deletingMissionId={deletingMissionId}
                    onDelete={(entry) => void handleDelete(entry)}
                    onViewBreakdown={setBreakdownEntry}
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
                  onDelete={(entry) => void handleDelete(entry)}
                  onViewBreakdown={setBreakdownEntry}
                  expandControl={{
                    expanded,
                    childCount: item.children.length,
                    onToggle: () => toggleGroup(item.rallyPointId),
                  }}
                />
                {expanded ? (
                  <ul className="space-y-2 border-l-2 border-border pl-3">
                    {item.children.map((child) => (
                      <li key={child.participantId}>
                        <MyMissionCard
                          entry={child}
                          deletingMissionId={deletingMissionId}
                          onDelete={(entry) => void handleDelete(entry)}
                          onViewBreakdown={setBreakdownEntry}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {breakdownEntry ? (
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
