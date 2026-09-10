import { CampaignRoleBadge } from '@/components/campaign/CampaignRoleBadge';
import {
  campaignRoleDescription,
  deriveCampaignRoles,
  formatOccurrenceDate,
  groupOccurrencesByWeek,
  selectCampaignPreviewWeekNumbers,
  type CampaignOccurrenceRole,
  type PlannedCampaignOccurrence,
} from '@/lib/campaign';

interface CampaignSchedulePreviewProps {
  occurrences: PlannedCampaignOccurrence[];
  /** Weeks to render from the start before eliding the middle. */
  previewWeeks?: number;
}

export function CampaignSchedulePreview({
  occurrences,
  previewWeeks = 2,
}: CampaignSchedulePreviewProps) {
  const weeks = groupOccurrencesByWeek(occurrences);
  if (weeks.length === 0) {
    return null;
  }

  const roleBySequence = new Map<number, CampaignOccurrenceRole>();
  deriveCampaignRoles(occurrences).forEach((role, index) => {
    roleBySequence.set(occurrences[index].sequence, role);
  });

  // Opening weeks, every week that holds a retest, and the finale. A mid-point
  // checkpoint must not disappear into "N more weeks of training".
  const retestWeekNumbers = new Set<number>();
  for (const week of weeks) {
    if (
      week.occurrences.some((occurrence) => roleBySequence.get(occurrence.sequence) === 'retest')
    ) {
      retestWeekNumbers.add(week.weekNumber);
    }
  }

  const shownWeekNumbers = new Set<number>(
    selectCampaignPreviewWeekNumbers({
      weekNumbers: weeks.map((week) => week.weekNumber),
      retestWeekNumbers,
      openingWeeks: previewWeeks,
    })
  );
  const shown = weeks.filter((week) => shownWeekNumbers.has(week.weekNumber));

  return (
    <div className="space-y-4">
      {shown.map((week, shownIndex) => {
        const previousWeekNumber = shownIndex > 0 ? shown[shownIndex - 1].weekNumber : null;
        const gap = previousWeekNumber !== null ? week.weekNumber - previousWeekNumber - 1 : 0;

        return (
          <div key={week.weekNumber} className="space-y-2">
            {gap > 0 ? (
              <p className="pt-2 text-xs text-muted">
                {gap} more {gap === 1 ? 'week' : 'weeks'} of training, then:
              </p>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
              Week {week.weekNumber}
            </p>
            <ul className="divide-y divide-divider rounded-card border border-border bg-surface">
              {week.occurrences.map((occurrence) => {
                const role = roleBySequence.get(occurrence.sequence) ?? 'build';
                return (
                  <li key={occurrence.sequence} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
                        {formatOccurrenceDate(occurrence.localDate)}
                        <span className="font-normal text-secondary">{occurrence.localTime}</span>
                        <CampaignRoleBadge role={role} />
                      </span>
                      <span className="text-sm text-secondary">
                        {occurrence.workoutName}
                        <span className="ml-2 text-xs text-muted">
                          {occurrence.durationMinutes} min
                        </span>
                      </span>
                    </div>
                    {campaignRoleDescription(role) ? (
                      <p className="text-xs text-muted">{campaignRoleDescription(role)}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
