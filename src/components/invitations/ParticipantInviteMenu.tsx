import { useState } from 'react';
import { SendInvitationFlow } from '@/components/invitations/SendInvitationFlow';
import { sendSquadInvite } from '@/lib/api/squad';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type { InvitationType } from '@/lib/invitations/invitationPresentation';

interface ParticipantInviteMenuProps {
  userId: string;
  nickname: string;
  isFriend: boolean;
  isSelf: boolean;
  sourceMissionId: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  canInviteCampaign?: boolean;
}

export function ParticipantInviteMenu({
  userId,
  nickname,
  isFriend,
  isSelf,
  sourceMissionId,
  durationMinutes,
  workout,
  templateId = null,
  intensityTier = null,
  canInviteCampaign = false,
}: ParticipantInviteMenuProps) {
  const [open, setOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowType, setFlowType] = useState<InvitationType>('workout');
  const [includeSquad, setIncludeSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (isSelf) {
    return null;
  }

  async function handleSquadOnly() {
    setBusy(true);
    setError(null);
    const result = await sendSquadInvite(userId);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSent(`Squad invite sent to ${nickname}.`);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="text-xs font-semibold text-accent"
        aria-expanded={open}
        aria-label={`Invite ${nickname}`}
        onClick={() => setOpen((current) => !current)}
      >
        Invite
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 space-y-1 rounded-card border border-border bg-surface p-2 shadow-card">
          {!isFriend ? (
            <button
              type="button"
              className="block w-full px-2 py-1 text-left text-sm text-ink hover:bg-surface-muted"
              disabled={busy}
              onClick={() => void handleSquadOnly()}
            >
              Invite to squad
            </button>
          ) : null}
          <button
            type="button"
            className="block w-full px-2 py-1 text-left text-sm text-ink hover:bg-surface-muted"
            onClick={() => {
              setFlowType('workout');
              setIncludeSquad(!isFriend);
              setFlowOpen(true);
              setOpen(false);
            }}
          >
            {isFriend ? 'Send workout' : 'Invite to squad and send'}
          </button>
          {canInviteCampaign ? (
            <button
              type="button"
              className="block w-full px-2 py-1 text-left text-sm text-ink hover:bg-surface-muted"
              onClick={() => {
                setFlowType('campaign');
                setIncludeSquad(!isFriend);
                setFlowOpen(true);
                setOpen(false);
              }}
            >
              Send campaign invitation
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-error mt-1 text-xs">{error}</p> : null}
      {sent ? <p className="mt-1 text-xs text-secondary">{sent}</p> : null}
      <SendInvitationFlow
        key={flowOpen ? `${flowType}-${includeSquad}` : 'closed'}
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        onSent={setSent}
        sourceMissionId={sourceMissionId}
        durationMinutes={durationMinutes}
        workout={workout}
        templateId={templateId}
        intensityTier={intensityTier}
        defaultType={flowType}
        allowedTypes={flowType === 'campaign' ? ['campaign'] : ['workout']}
        lockRecipientUserId={userId}
        recipientIsFriend={isFriend}
        defaultIncludeSquadInvite={includeSquad}
      />
    </div>
  );
}
