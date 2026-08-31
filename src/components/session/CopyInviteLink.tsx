import { useCopySessionInvite } from '@/components/session/useCopySessionInvite';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { ogCardFromSex } from '@/lib/share/ogCard';

interface CopyInviteLinkProps {
  sessionId: string;
  rallyPointId?: string | null;
  /** When true, omit the outer walkthrough wrapper (parent owns the anchor). */
  embedded?: boolean;
  className?: string;
}

export function CopyInviteLink({
  sessionId,
  rallyPointId = null,
  embedded = false,
  className,
}: CopyInviteLinkProps) {
  const { profile } = useAthleteProfile();
  const card = ogCardFromSex(profile?.biologicalSex);
  const { secured, error, copyInvite } = useCopySessionInvite(sessionId, rallyPointId, card);

  const button = (
    <button
      type="button"
      className={className ?? 'btn-primary w-full px-3 py-1.5 text-xs uppercase tracking-widest'}
      onClick={() => void copyInvite()}
    >
      {secured ? 'LINK COPIED' : 'COPY RALLY LINK'}
    </button>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        {button}
        {error ? <p className="text-error text-sm">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-walkthrough-id="rally-link">
      {button}
      {error ? <p className="text-error text-sm">{error}</p> : null}
    </div>
  );
}
