import { AppLink } from '@/components/AppLink';
import type { InvitationCardData } from '@/lib/api/invitations';
import {
  campaignJoinCtaLabel,
  campaignViewCtaLabel,
  formatInvitationWhen,
  invitationHeadline,
  missionInvitationAction,
  missionInvitationCtaLabel,
  workoutInvitationCtaLabel,
} from '@/lib/invitations/invitationPresentation';

export interface InvitationCardProps {
  card: InvitationCardData;
  variant?: 'inbox' | 'chat';
  isAuthenticated?: boolean;
  busy?: boolean;
  onPrimary?: () => void;
  onJoinCampaign?: () => void;
  onAcceptSquad?: () => void;
  onDismiss?: () => void;
  onBlock?: () => void;
  onSaveToInbox?: () => void;
  onSignInToSave?: () => void;
  viewerUserId?: string | null;
}

function movementLine(card: InvitationCardData): string | null {
  if (!card.workout.length) {
    return null;
  }
  return card.workout.map((movement) => movement.name).join(' · ');
}

export function InvitationCard({
  card,
  variant = 'inbox',
  isAuthenticated = true,
  busy = false,
  onPrimary,
  onJoinCampaign,
  onAcceptSquad,
  onDismiss,
  onBlock,
  onSaveToInbox,
  onSignInToSave,
  viewerUserId = null,
}: InvitationCardProps) {
  const duration = card.durationMinutes ?? card.mission?.durationMinutes ?? 15;
  const weekCount = card.campaign?.weekCount ?? 8;
  const headline = invitationHeadline({
    senderName: card.fromNickname,
    type: card.type,
    durationMinutes: duration,
    campaignWeekCount: card.campaign?.weekCount ?? null,
    includeSquadInvite: Boolean(card.includeSquadInvite && card.squadRequestId),
  });
  const when = formatInvitationWhen(card.mission?.scheduledAt ?? null);
  const missionAction = card.mission
    ? missionInvitationAction({
        state: card.mission.state === 'unknown' ? null : card.mission.state,
        scheduledAt: card.mission.scheduledAt,
        alreadyJoined: card.mission.alreadyJoined,
        joinable: card.mission.joinable,
      })
    : null;
  const movements = movementLine(card);
  const squadPending = card.squadRequestId && card.squadStatus === 'pending';
  const isOwnCard = Boolean(viewerUserId && viewerUserId === card.fromUserId);
  const showSave =
    variant === 'chat' &&
    !card.deliveryId &&
    isAuthenticated &&
    !isOwnCard &&
    Boolean(onSaveToInbox);
  const showSignInSave =
    variant === 'chat' && !card.deliveryId && !isAuthenticated && Boolean(onSignInToSave);

  let primaryLabel: string | null = null;
  if (card.type === 'workout') {
    primaryLabel = workoutInvitationCtaLabel(duration);
  } else if (card.type === 'mission' && missionAction) {
    primaryLabel = missionInvitationCtaLabel(missionAction, duration);
  } else if (card.type === 'campaign') {
    primaryLabel = campaignViewCtaLabel(weekCount);
  }

  const primaryDisabled =
    busy ||
    (card.type === 'mission' && missionAction === 'unavailable') ||
    card.status === 'unavailable';

  return (
    <article className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
      <p className="text-sm font-semibold text-ink">{headline}</p>
      {when ? <p className="text-xs text-secondary">{when}</p> : null}
      {card.campaign ? (
        <p className="text-xs text-secondary">
          {card.campaign.name}
          {card.campaign.hostNickname ? ` · Host ${card.campaign.hostNickname}` : ''}
          {card.campaign.startDate ? ` · Starts ${card.campaign.startDate}` : ''}
        </p>
      ) : null}
      {movements ? <p className="text-sm text-secondary">{movements}</p> : null}
      {card.note ? <p className="text-sm text-muted">“{card.note}”</p> : null}
      {card.status === 'unavailable' ? (
        <p className="text-xs text-secondary">This is no longer available.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {squadPending && onAcceptSquad ? (
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={busy}
            onClick={onAcceptSquad}
          >
            Accept squad invite
          </button>
        ) : null}

        {card.type === 'workout' && card.resultingMissionId ? (
          <AppLink className="btn-primary text-sm" to={`/mission/${card.resultingMissionId}`}>
            Return to {duration}-min mission
          </AppLink>
        ) : null}

        {card.type === 'workout' && onPrimary && !card.resultingMissionId ? (
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={onPrimary}>
            {busy ? 'Starting…' : primaryLabel}
          </button>
        ) : null}

        {card.type === 'mission' && card.mission ? (
          missionAction === 'join_mission' && onPrimary ? (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={primaryDisabled}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>
          ) : missionAction === 'unavailable' ? (
            <button type="button" className="btn-primary text-sm" disabled>
              {primaryLabel}
            </button>
          ) : (
            <AppLink className="btn-primary text-sm" to={`/mission/${card.mission.id}`}>
              {primaryLabel}
            </AppLink>
          )
        ) : null}

        {card.type === 'campaign' && card.campaign ? (
          <>
            <AppLink className="btn-outline text-sm" to={`/campaign/${card.campaign.id}`}>
              {campaignViewCtaLabel(weekCount)}
            </AppLink>
            {card.campaign.joinable && onJoinCampaign ? (
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy}
                onClick={onJoinCampaign}
              >
                {busy ? 'Joining…' : campaignJoinCtaLabel(weekCount)}
              </button>
            ) : null}
          </>
        ) : null}

        {showSave ? (
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={busy}
            onClick={onSaveToInbox}
          >
            Save to Sent to you
          </button>
        ) : null}

        {showSignInSave ? (
          <button type="button" className="btn-outline text-sm" onClick={onSignInToSave}>
            Sign in to save
          </button>
        ) : null}
      </div>

      {variant === 'inbox' && card.status === 'pending' ? (
        <div className="flex flex-wrap gap-3">
          {onDismiss ? (
            <button
              type="button"
              className="text-sm font-semibold text-secondary hover:text-ink"
              disabled={busy}
              onClick={onDismiss}
            >
              Dismiss
            </button>
          ) : null}
          {onBlock ? (
            <button
              type="button"
              className="text-sm font-semibold text-secondary hover:text-ink"
              disabled={busy}
              onClick={onBlock}
            >
              Block future invitations
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
