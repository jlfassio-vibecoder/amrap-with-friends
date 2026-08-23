import {
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForScrollList,
  type ParticipantRosterEntry,
} from '@/lib/sessionSync/buildParticipantRoster';

interface ParticipantsPanelProps {
  roster: ParticipantRosterEntry[];
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
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white tabular-nums">
        {rank}
      </span>
    );
  }

  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold text-amber-600 tabular-nums">
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-medium text-gray-500 tabular-nums">
      {rank}
    </span>
  );
}

function RosterRow({
  entry,
  variant = 'default',
}: {
  entry: ParticipantRosterEntry;
  variant?: 'default' | 'pinned';
}) {
  return (
    <div
      className={
        variant === 'pinned'
          ? 'flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-2 py-2'
          : 'flex items-center gap-3 px-2 py-1.5'
      }
    >
      <RankBadge rank={entry.rank} variant={variant === 'pinned' ? 'pinned' : 'default'} />
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
          entry.isOnline ? 'bg-green-500' : 'bg-gray-300'
        }`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {entry.nickname}
        {entry.isSelf ? ' (you)' : ''}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{entry.roundCount}</span>
    </div>
  );
}

export function ParticipantsPanel({ roster, className }: ParticipantsPanelProps) {
  const onlineCount = roster.filter((entry) => entry.isOnline).length;
  const onlineEntries = roster.filter((entry) => entry.isOnline);
  const visibleAvatars = onlineEntries.slice(0, AVATAR_STACK_LIMIT);
  const overflowCount = Math.max(0, onlineEntries.length - AVATAR_STACK_LIMIT);
  const scrollEntries = rosterEntriesForScrollList(roster);
  const selfEntry = roster.find((entry) => entry.isSelf) ?? null;

  return (
    <section
      className={`space-y-3 rounded border border-gray-300 p-4 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold lg:text-base">Participants</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
          {onlineCount} here
        </span>
      </div>

      {visibleAvatars.length > 0 ? (
        <div className="flex items-center">
          {visibleAvatars.map((entry, index) => (
            <span
              key={entry.participantId}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white ${getParticipantAvatarColor(entry.participantId)} ${
                index > 0 ? '-ml-2' : ''
              }`}
              title={entry.nickname}
            >
              {getParticipantInitial(entry.nickname)}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-700 text-xs font-semibold text-white">
              +{overflowCount}
            </span>
          ) : null}
        </div>
      ) : null}

      {roster.length === 0 ? (
        <p className="text-sm text-gray-600">No participants yet.</p>
      ) : (
        <>
          <div className="max-h-48 space-y-1 overflow-y-auto lg:max-h-52">
            {scrollEntries.length === 0 ? (
              <p className="px-2 text-sm text-gray-600">No other participants yet.</p>
            ) : (
              scrollEntries.map((entry) => (
                <RosterRow key={entry.participantId} entry={entry} />
              ))
            )}
          </div>

          {selfEntry ? <RosterRow entry={selfEntry} variant="pinned" /> : null}
        </>
      )}
    </section>
  );
}
