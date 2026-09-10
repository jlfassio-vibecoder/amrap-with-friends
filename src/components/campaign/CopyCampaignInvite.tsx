import { buildCampaignInviteUrl } from '@/lib/campaign';
import { useCopyFlash } from '@/hooks/useCopyFlash';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { track } from '@/lib/analytics/track';
import { ogCardFromSex } from '@/lib/share/ogCard';

interface CopyCampaignInviteProps {
  inviteCode: string;
  campaignId: string;
}

export function CopyCampaignInvite({ inviteCode, campaignId }: CopyCampaignInviteProps) {
  const { copied, error, copy } = useCopyFlash();
  const { profile } = useAthleteProfile();
  const inviteUrl = buildCampaignInviteUrl(
    inviteCode,
    window.location.origin,
    ogCardFromSex(profile?.biologicalSex)
  );

  async function handleCopy() {
    const ok = await copy(inviteUrl, `Could not copy. Share this link manually: ${inviteUrl}`);
    if (ok) {
      // campaign_id rides in props: TrackContext only carries mission-scoped
      // ids, and widening it would mean an analytics_events migration.
      track('campaign_invite_copied', { campaign_id: campaignId });
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary text-xs uppercase tracking-widest"
        onClick={() => void handleCopy()}
      >
        {copied ? 'LINK COPIED' : 'COPY RALLY LINK'}
      </button>
      <p className="text-xs text-secondary">
        Anyone with this link can join the campaign. They will need an account, since a campaign
        tracks weeks of work.
      </p>
      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
