import { useState } from 'react';
import { PacingBadge } from '@/components/PacingBadge';
import {
  buildParticipantRoster,
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForDisplay,
  type LeaderboardSortMode,
  type ParticipantRosterEntry,
} from '@/lib/sessionSync/buildParticipantRoster';
import type {
  LeaderboardEntry,
  LiveSessionPhase,
  SessionPresenceEntry,
} from '@/lib/sessionSync/types';

interface ParticipantsPanelProps {
  leaderboard: LeaderboardEntry[];
  presence: SessionPresenceEntry[];
  selfParticipantId: string;
  phase: LiveSessionPhase;
  className?: string;
}

const AVATAR_STACK_LIMIT = 5;

function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}

function formatRosterScore(
  entry: ParticipantRosterEntry,
  phase: LiveSessionPhase,
  sortMode: LeaderboardSortMode
): string {
  if (phase === 'finished' && sortMode === 'discipline' && entry.pvi !== null) {
    return `${entry.pvi}% · ${formatMultiplier(entry.pviMultiplier)}`;
  }

  const score = phase === 'finished' ? entry.finalScore : entry.baseScore;
  const unit = entry.repsPerRound > 0 ? 'reps' : 'rounds';
  const value = entry.repsPerRound > 0 ? score : entry.roundCount;
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold text-accent tabular-nums">
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-medium text-muted tabular-nums">
      {rank}
    </span>
  );
}

function RosterRow({
  entry,
  phase,
  sortMode,
}: {
  entry: ParticipantRosterEntry;
  phase: LiveSessionPhase;
  sortMode: LeaderboardSortMode;
}) {
  const showPacingBadge = phase === 'finished' && entry.pviVerdict.length > 0;
  const scoreDisplay = formatRosterScore(entry, phase, sortMode);

  return (
    <div role="listitem" className="flex items-center gap-2 px-2 py-1.5">
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
      {showPacingBadge ? (
        <PacingBadge
          classification={entry.pviClassification}
          verdict={entry.pviVerdict}
        />
      ) : null}
      <span className="shrink-0 text-sm font-semibold tabular-nums">{scoreDisplay}</span>
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
  const hasAnyParticipants = leaderboard.length > 0 || presence.length > 0;
  const showDisciplineEmptyState =
    phase === 'finished' &&
    effectiveSortMode === 'discipline' &&
    hasAnyParticipants &&
    roster.length === 0;

  return (
    <section
      className={`card flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4 ${className ?? ''}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-display text-sm text-ink lg:text-base">Participants</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-xs font-medium text-success-text">
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
              className="min-h-0 max-h-48 flex-1 space-y-1 overflow-y-auto lg:max-h-none"
            >
              {displayEntries.map((entry) => (
                <RosterRow
                  key={entry.participantId}
                  entry={entry}
                  phase={phase}
                  sortMode={effectiveSortMode}
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
