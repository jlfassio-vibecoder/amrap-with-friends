import { useCopySessionInvite } from '@/components/session/useCopySessionInvite';

interface CopyInviteLinkProps {
  sessionId: string;
  /** When true, omit the outer walkthrough wrapper (parent owns the anchor). */
  embedded?: boolean;
  className?: string;
}

export function CopyInviteLink({
  sessionId,
  embedded = false,
  className,
}: CopyInviteLinkProps) {
  const { secured, error, copyInvite } = useCopySessionInvite(sessionId);

  const button = (
    <button
      type="button"
      className={
        className ??
        'btn-primary w-full px-3 py-1.5 text-xs uppercase tracking-widest'
      }
      onClick={() => void copyInvite()}
    >
      {secured ? 'LINK SECURED' : 'COPY SESSION LINK'}
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
