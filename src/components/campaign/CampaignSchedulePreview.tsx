import {
  formatOccurrenceDate,
  groupOccurrencesByWeek,
  type PlannedCampaignOccurrence,
} from '@/lib/campaign';

interface CampaignSchedulePreviewProps {
  occurrences: PlannedCampaignOccurrence[];
  /** Weeks to render before collapsing the rest into a count. */
  previewWeeks?: number;
}

export function CampaignSchedulePreview({
  occurrences,
  previewWeeks = 2,
}: CampaignSchedulePreviewProps) {
  const weeks = groupOccurrencesByWeek(occurrences);
  const shown = weeks.slice(0, previewWeeks);
  const remaining = weeks.length - shown.length;

  if (weeks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {shown.map((week) => (
        <div key={week.weekNumber} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
            Week {week.weekNumber}
          </p>
          <ul className="divide-y divide-divider rounded-card border border-border bg-surface">
            {week.occurrences.map((occurrence) => (
              <li
                key={occurrence.sequence}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="text-sm font-semibold text-ink">
                  {formatOccurrenceDate(occurrence.localDate)}
                  <span className="ml-2 font-normal text-secondary">{occurrence.localTime}</span>
                </span>
                <span className="text-sm text-secondary">
                  {occurrence.workoutName}
                  <span className="ml-2 text-xs text-muted">
                    {occurrence.durationMinutes} min
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {remaining > 0 ? (
        <p className="text-xs text-muted">
          + {remaining} more {remaining === 1 ? 'week' : 'weeks'} on the same pattern.
        </p>
      ) : null}
    </div>
  );
}
