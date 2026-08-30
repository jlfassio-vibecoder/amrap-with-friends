import { CampaignRoleBadge } from '@/components/campaign/CampaignRoleBadge';
import {
  campaignRoleDescription,
  deriveCampaignRoles,
  formatOccurrenceDate,
  groupOccurrencesByWeek,
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

  // Show the opening weeks and the final week, never a middle slice: the
  // campaign's two most important sessions are its first and its last, and a
  // preview that hides the finish hides the point of the plan.
  const opening = weeks.slice(0, previewWeeks);
  const finale = weeks.length > opening.length ? weeks[weeks.length - 1] : null;
  const hiddenWeeks = weeks.length - opening.length - (finale ? 1 : 0);

  const shown = finale ? [...opening, finale] : opening;

  return (
    <div className="space-y-4">
      {shown.map((week) => (
        <div key={week.weekNumber} className="space-y-2">
          {finale && week === finale && hiddenWeeks > 0 ? (
            <p className="pt-2 text-xs text-muted">
              {hiddenWeeks} more {hiddenWeeks === 1 ? 'week' : 'weeks'} of training, then:
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
      ))}
    </div>
  );
}
