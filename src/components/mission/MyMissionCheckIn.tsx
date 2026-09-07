import { CHECK_IN_DIMENSIONS } from '@/data/missionCheckIn';
import { rpeLabel, type MissionCheckIns } from '@/lib/mission/missionCheckIn';

interface MyMissionCheckInProps {
  rpe: number | null;
  sessionNotes: string;
  checkIns: MissionCheckIns;
}

/**
 * A stored check-in, read back in full.
 *
 * It used to be a "Check-in" word carrying the whole thing in a `title`
 * attribute, truncated to 40 characters. A `title` does not open on touch, is
 * not reachable by keyboard and is announced inconsistently — so on the phone
 * most of these missions are run from, an athlete could write 280 characters
 * under "Anything else to remember next time?" and never read a word of it
 * back. Asking for something and then not showing it is worse than not asking.
 */
export function MyMissionCheckIn({ rpe, sessionNotes, checkIns }: MyMissionCheckInProps) {
  const label = rpe === null ? null : rpeLabel(rpe);

  const chips = CHECK_IN_DIMENSIONS.flatMap((dimension) => {
    const optionId = checkIns[dimension.id];
    if (!optionId) {
      return [];
    }
    const option = dimension.options.find((entry) => entry.id === optionId);
    if (!option) {
      return [];
    }
    // "Felt pain" already reads as a sentence; "Pain: Felt pain" does not.
    return [
      {
        id: option.id,
        text: dimension.id === 'pain' ? option.label : `${dimension.title}: ${option.label}`,
      },
    ];
  });

  const notes = sessionNotes.trim();
  if (rpe === null && chips.length === 0 && notes.length === 0) {
    return null;
  }

  return (
    <details className="border-t border-divider pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-[0.75em] leading-none">
          ▼
        </span>
        Your check-in
      </summary>

      <div className="mt-2 space-y-2">
        {rpe !== null ? (
          <p className="text-sm text-ink">
            <span className="tabular-nums">RPE {rpe}</span>
            {label ? <span className="text-secondary"> · {label}</span> : null}
          </p>
        ) : null}

        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.id}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
              >
                {chip.text}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Whole, and wrapped: the point of writing it down is reading it later. */}
        {notes.length > 0 ? (
          <p className="whitespace-pre-wrap break-words text-sm text-secondary">{notes}</p>
        ) : null}
      </div>
    </details>
  );
}
