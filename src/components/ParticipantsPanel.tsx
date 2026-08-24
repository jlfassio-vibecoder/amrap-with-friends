import {
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForScrollList,
  type ParticipantRosterEntry,
} from '@/lib/sessionSync/buildParticipantRoster';

import type { LiveSessionPhase } from '@/lib/sessionSync/types';

interface ParticipantsPanelProps {
  roster: ParticipantRosterEntry[];
  phase: LiveSessionPhase;
  className?: string;
}

const AVATAR_STACK_LIMIT = 5;

function RankBadge({
  rank,
  variant = 'default',
}: {
  rank: number;
  variant?: 'default' | 'pinned';
}) {
  if (variant === 'pinned') {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent tabular-nums">
        {rank}
      </span>
    );
  }

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
  variant = 'default',
}: {
  entry: ParticipantRosterEntry;
  phase: LiveSessionPhase;
  variant?: 'default' | 'pinned';
}) {
  const displayScore = phase === 'finished' ? entry.adjustedScore : entry.baseScore;

  return (
    <div
      role="listitem"
      className={
        variant === 'pinned'
          ? 'flex items-center gap-3 rounded-md border border-border bg-accent-tint px-2 py-2'
          : 'flex items-center gap-3 px-2 py-1.5'
      }
    >
      <RankBadge rank={entry.rank} variant={variant === 'pinned' ? 'pinned' : 'default'} />
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
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {displayScore} reps
      </span>
    </div>
  );
}

export function ParticipantsPanel({ roster, phase, className }: ParticipantsPanelProps) {
  const onlineCount = roster.filter((entry) => entry.isOnline).length;
  const onlineEntries = roster.filter((entry) => entry.isOnline);
  const visibleAvatars = onlineEntries.slice(0, AVATAR_STACK_LIMIT);
  const overflowCount = Math.max(0, onlineEntries.length - AVATAR_STACK_LIMIT);
  const scrollEntries = rosterEntriesForScrollList(roster);
  const selfEntry = roster.find((entry) => entry.isSelf) ?? null;

  return (
    <section className={`card space-y-3 p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-display text-sm text-ink lg:text-base">Participants</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-xs font-medium text-success-text">
          <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden />
          {onlineCount} here
        </span>
      </div>

      {visibleAvatars.length > 0 ? (
        <div className="flex items-center" aria-hidden="true">
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
          {overflowCount > 0 ? (
            <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-page bg-neutral text-xs font-semibold text-neutral-foreground">
              +{overflowCount}
            </span>
          ) : null}
        </div>
      ) : null}

      {roster.length === 0 ? (
        <p className="text-sm text-secondary">No participants yet.</p>
      ) : (
        <>
          <div
            role="list"
            className="max-h-48 space-y-1 overflow-y-auto lg:max-h-52"
          >
            {scrollEntries.length === 0 ? (
              <p className="px-2 text-sm text-secondary">No other participants yet.</p>
            ) : (
              scrollEntries.map((entry) => (
                <RosterRow key={entry.participantId} entry={entry} phase={phase} />
              ))
            )}
          </div>

          {selfEntry ? (
            <div role="list" aria-label="Your rank">
              <RosterRow entry={selfEntry} phase={phase} variant="pinned" />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
