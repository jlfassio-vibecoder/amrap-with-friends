import { campaignRoleLabel, type CampaignOccurrenceRole } from '@/lib/campaign';

const ROLE_CLASSES: Record<CampaignOccurrenceRole, string> = {
  benchmark: 'border-accent text-accent',
  retest: 'border-accent text-accent',
  deload: 'border-border text-muted',
  build: '',
};

/**
 * Marks the three missions in a campaign that are not just another workout.
 * Ordinary missions get no badge — a label on every row labels nothing.
 */
export function CampaignRoleBadge({ role }: { role: CampaignOccurrenceRole }) {
  const label = campaignRoleLabel(role);
  if (!label) {
    return null;
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest ${ROLE_CLASSES[role]}`}
    >
      {label}
    </span>
  );
}
