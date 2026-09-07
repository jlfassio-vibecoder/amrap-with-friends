import {
  CHECK_IN_DIMENSIONS,
  PAIN_CHECK_IN_WARNING,
  RPE_OPTIONS,
  type CheckInDimensionId,
} from '@/data/missionCheckIn';
import { MAX_SESSION_NOTES_LENGTH, type MissionCheckIns } from '@/lib/mission/missionCheckIn';

export interface MissionCheckInValue {
  rpe: number | null;
  sessionNotes: string;
  checkIns: MissionCheckIns;
}

interface MissionCheckInPanelProps {
  value: MissionCheckInValue;
  disabled?: boolean;
  onChange: (value: MissionCheckInValue) => void;
}

/**
 * Optional post-mission notes: RPE, single-click dimensions, free text.
 *
 * Collapsed by default so the honesty lock stays the short path. Never required
 * and never changes the score.
 */
export function MissionCheckInPanel({
  value,
  disabled = false,
  onChange,
}: MissionCheckInPanelProps) {
  const chosenCount =
    (value.rpe !== null ? 1 : 0) +
    Object.keys(value.checkIns).length +
    (value.sessionNotes.trim().length > 0 ? 1 : 0);

  function setRpe(next: number) {
    onChange({
      ...value,
      rpe: value.rpe === next ? null : next,
    });
  }

  function setDimension(dimensionId: CheckInDimensionId, optionId: string) {
    const current = value.checkIns[dimensionId];
    const nextCheckIns = { ...value.checkIns };
    if (current === optionId) {
      delete nextCheckIns[dimensionId];
    } else {
      nextCheckIns[dimensionId] = optionId;
    }
    onChange({ ...value, checkIns: nextCheckIns });
  }

  return (
    <details className="rounded-card border border-border bg-page p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-[0.75em] leading-none">
          ▼
        </span>
        Notes for this mission?
        {chosenCount > 0 ? (
          <span className="ml-auto text-xs font-normal text-secondary">{chosenCount} set</span>
        ) : null}
      </summary>

      <div className="mt-3 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">RPE</legend>
          <div className="flex flex-wrap gap-1.5">
            {RPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-pressed={value.rpe === option.value}
                disabled={disabled}
                className={
                  value.rpe === option.value
                    ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
                    : 'rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink'
                }
                onClick={() => setRpe(option.value)}
              >
                <span className="tabular-nums">{option.value}</span>
                <span className="ml-1 text-[0.7rem] opacity-80">{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {CHECK_IN_DIMENSIONS.map((dimension) => (
          <fieldset key={dimension.id} className="space-y-1.5">
            <legend className="text-sm font-semibold text-ink">{dimension.title}</legend>
            <div className="flex flex-wrap gap-1.5">
              {dimension.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={value.checkIns[dimension.id] === option.id}
                  disabled={disabled}
                  className={
                    value.checkIns[dimension.id] === option.id
                      ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
                      : 'rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink'
                  }
                  onClick={() => setDimension(dimension.id, option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {dimension.id === 'pain' && value.checkIns.pain === 'pain--felt' ? (
              <p role="status" className="text-sm leading-relaxed text-secondary">
                {PAIN_CHECK_IN_WARNING}
              </p>
            ) : null}
          </fieldset>
        ))}

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Notes</span>
          <textarea
            className="input-field min-h-20 w-full resize-y text-sm"
            placeholder="Anything else to remember next time?"
            maxLength={MAX_SESSION_NOTES_LENGTH}
            disabled={disabled}
            value={value.sessionNotes}
            onChange={(event) => onChange({ ...value, sessionNotes: event.target.value })}
          />
        </label>

        <p className="text-xs text-muted">Optional. Does not change your score.</p>
      </div>
    </details>
  );
}
