import { useEffect, useRef, useState } from 'react';
import { formatModifiedBadge } from '@/lib/mission/modifiedMovements';
import { formatVariantBadge } from '@/lib/mission/exerciseScaling';
import { PacingBadge } from '@/components/PacingBadge';
import {
  buildParticipantRoster,
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForDisplay,
  type LeaderboardSortMode,
  type ParticipantRosterEntry,
} from '@/lib/missionSync/buildParticipantRoster';
import type {
  LeaderboardEntry,
  LiveMissionPhase,
  MissionPresenceEntry,
} from '@/lib/missionSync/types';
import {
  rosterBarPercent,
  rosterBarScore,
  rosterLeaderScore,
  shouldShowRosterBars,
} from '@/lib/missionSync/rosterBars';
import { participantsWhoAdvanced, roundCountsById } from '@/lib/missionSync/roundFlash';

interface ParticipantsPanelProps {
  leaderboard: LeaderboardEntry[];
  presence: MissionPresenceEntry[];
  selfParticipantId: string;
  phase: LiveMissionPhase;
  className?: string;
}

const AVATAR_STACK_LIMIT = 5;

function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}

function formatRosterScore(
  entry: ParticipantRosterEntry,
  phase: LiveMissionPhase,
  sortMode: LeaderboardSortMode
): string {
  if (phase === 'finished' && sortMode === 'discipline' && entry.pvi !== null) {
    return `${entry.pvi}% · ${formatMultiplier(entry.pviMultiplier)}`;
  }

  // Always baseScore, never finalScore: finalScore is baseScore adjusted by
  // P.V.I. and Domain, and is worth more or less than the reps the athlete
  // actually did. It ranks the "Absolute" sort (compareAbsoluteRoster reads
  // finalScore directly), but the number shown next to "reps" here must stay
  // the real rep count or it reads as a different — wrong — workout result.
  const unit = entry.repsPerRound > 0 ? 'reps' : 'rounds';
  const value = entry.repsPerRound > 0 ? entry.baseScore : entry.roundCount;
  return `${value} ${unit}`;
}

function LeaderboardSortToggle({
  value,
  onChange,
}: {
  value: LeaderboardSortMode;
  onChange: (value: LeaderboardSortMode) => void;
}) {
  return (
    <div
      className="inline-flex w-full rounded-full border border-border bg-page p-1"
      role="tablist"
      aria-label="Leaderboard view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'absolute'}
        className={
          value === 'absolute'
            ? 'flex-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent'
            : 'flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary hover:text-ink'
        }
        onClick={() => onChange('absolute')}
      >
        Absolute
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'discipline'}
        className={
          value === 'discipline'
            ? 'flex-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent'
            : 'flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary hover:text-ink'
        }
        onClick={() => onChange('discipline')}
      >
        Discipline
      </button>
    </div>
  );
}

/**
 * Rows that should pulse because their athlete just landed a round.
 *
 * Held for a beat and then cleared, so a round reads as a beat rather than a
 * permanent state. The previous counts live in a ref because they are a
 * comparison input, not something the render should react to.
 */
function useRoundFlash(roster: ParticipantRosterEntry[]): Set<string> {
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set());
  const previousRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const next = roundCountsById(roster);
    const advanced = participantsWhoAdvanced(previousRef.current, next);
    previousRef.current = next;
    if (advanced.length === 0) {
      return;
    }
    setFlashing(new Set(advanced));
    const timer = window.setTimeout(() => setFlashing(new Set()), 400);
    return () => window.clearTimeout(timer);
  }, [roster]);

  return flashing;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-accent">
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-medium tabular-nums text-muted">
      {rank}
    </span>
  );
}

function RosterRow({
  entry,
  phase,
  sortMode,
  barPercent,
  showBar,
  isFlashing,
}: {
  entry: ParticipantRosterEntry;
  phase: LiveMissionPhase;
  sortMode: LeaderboardSortMode;
  barPercent: number;
  showBar: boolean;
  isFlashing: boolean;
}) {
  const showPacingBadge = phase === 'finished' && entry.pviVerdict.length > 0;
  const scoreDisplay = formatRosterScore(entry, phase, sortMode);
  // Shown, never hidden and never removed from the board: an honest mark that
  // costs an athlete their place on it would stop being given.
  const modifiedBadge =
    formatVariantBadge(entry.movementVariants) ?? formatModifiedBadge(entry.modifiedMovements);

  return (
    <div role="listitem" className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        <RankBadge rank={entry.rank} />
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
            entry.isOnline ? 'bg-success' : 'bg-muted'
          }`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          {entry.nickname}
          {entry.isSelf ? ' (you)' : ''}
        </span>
        {modifiedBadge ? (
          <span
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary"
            title={modifiedBadge}
          >
            Modified
          </span>
        ) : null}
        {showPacingBadge ? (
          <PacingBadge classification={entry.pviClassification} verdict={entry.pviVerdict} />
        ) : null}
        <span className="shrink-0 text-sm font-semibold tabular-nums">{scoreDisplay}</span>
      </div>
      {/* The bar is the creators board's whole idea: the gap between athletes
          read at a glance rather than by comparing two numbers. Decorative —
          the score beside it is the accessible value, so this is aria-hidden
          rather than a second thing for a screen reader to announce. */}
      {showBar ? (
        <div aria-hidden className="ml-9 mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${
              entry.isSelf ? 'bg-accent' : 'bg-success'
            } ${isFlashing ? 'brightness-150' : ''}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ParticipantsPanel({
  leaderboard,
  presence,
  selfParticipantId,
  phase,
  className,
}: ParticipantsPanelProps) {
  const [sortMode, setSortMode] = useState<LeaderboardSortMode>('absolute');
  const effectiveSortMode = phase === 'finished' ? sortMode : 'absolute';
  const roster = buildParticipantRoster(
    leaderboard,
    presence,
    selfParticipantId,
    effectiveSortMode,
    phase
  );

  const onlineCount = roster.filter((entry) => entry.isOnline).length;
  const onlineEntries = roster.filter((entry) => entry.isOnline);
  const visibleAvatars = onlineEntries.slice(0, AVATAR_STACK_LIMIT);
  const avatarOverflowCount = Math.max(0, onlineEntries.length - AVATAR_STACK_LIMIT);
  const { visible: displayEntries, hiddenCount } = rosterEntriesForDisplay(roster);
  const showBars = shouldShowRosterBars(effectiveSortMode);
  const leaderScore = rosterLeaderScore(roster, phase);
  const flashing = useRoundFlash(roster);
  const hasAnyParticipants = leaderboard.length > 0 || presence.length > 0;
  const showDisciplineEmptyState =
    phase === 'finished' &&
    effectiveSortMode === 'discipline' &&
    hasAnyParticipants &&
    roster.length === 0;

  return (
    <section
      className={`card flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4 ${className ?? ''}`}
      data-walkthrough-id="participants"
    >
      <div className="relative flex shrink-0 items-center justify-center">
        <h2 className="text-display text-sm text-ink lg:text-base">Leaderboard</h2>
        <span className="absolute right-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-xs font-medium text-success-text">
          <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden />
          {onlineCount} here
        </span>
      </div>

      {phase === 'finished' ? (
        <div className="shrink-0">
          <LeaderboardSortToggle
            value={sortMode}
            onChange={(value) => {
              if (phase === 'finished') {
                setSortMode(value);
              }
            }}
          />
        </div>
      ) : null}

      {visibleAvatars.length > 0 ? (
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {visibleAvatars.map((entry, index) => (
            <span
              key={entry.participantId}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-page text-xs font-semibold text-on-accent ${getParticipantAvatarColor(entry.participantId)} ${
                index > 0 ? '-ml-2' : ''
              }`}
              title={entry.nickname}
            >
              {getParticipantInitial(entry.nickname)}
            </span>
          ))}
          {avatarOverflowCount > 0 ? (
            <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-page bg-neutral text-xs font-semibold text-neutral-foreground">
              +{avatarOverflowCount}
            </span>
          ) : null}
        </div>
      ) : null}

      {!hasAnyParticipants ? (
        <p className="text-sm text-secondary">No participants yet.</p>
      ) : showDisciplineEmptyState ? (
        <p className="text-display px-2 py-6 text-center text-sm leading-relaxed text-secondary">
          No pacing data established. The crucible demands more time.
        </p>
      ) : (
        <>
          {displayEntries.length === 0 ? (
            <p className="px-2 text-sm text-secondary">No participants yet.</p>
          ) : (
            <div
              role="list"
              className="max-h-48 min-h-0 flex-1 space-y-1 overflow-y-auto lg:max-h-none"
            >
              {displayEntries.map((entry) => (
                <RosterRow
                  key={entry.participantId}
                  entry={entry}
                  phase={phase}
                  sortMode={effectiveSortMode}
                  showBar={showBars}
                  barPercent={rosterBarPercent(rosterBarScore(entry, phase), leaderScore)}
                  isFlashing={flashing.has(entry.participantId)}
                />
              ))}
            </div>
          )}

          {hiddenCount > 0 ? (
            <p className="shrink-0 px-2 text-sm text-secondary">and {hiddenCount} more</p>
          ) : null}
        </>
      )}
    </section>
  );
}
