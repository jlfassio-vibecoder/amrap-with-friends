import { useEffect, useMemo, useState } from 'react';
import {
  createInvitation,
  fetchInvitationAudience,
  type InvitationAudience,
} from '@/lib/api/invitations';
import type { InvitationType } from '@/lib/invitations/invitationPresentation';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import {
  invitationAudienceSummary,
  sendInvitationTypeLabel,
} from '@/lib/invitations/invitationPresentation';

export interface SendInvitationContext {
  sourceMissionId?: string | null;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  defaultType?: InvitationType;
  allowedTypes?: InvitationType[];
  campaignId?: string | null;
  lockRecipientUserId?: string | null;
  recipientIsFriend?: boolean;
  defaultPostInChat?: boolean;
  defaultIncludeSquadInvite?: boolean;
}

interface SendInvitationFlowProps extends SendInvitationContext {
  open: boolean;
  onClose: () => void;
  onSent?: (summary: string) => void;
}

export function SendInvitationFlow({
  open,
  onClose,
  onSent,
  sourceMissionId = null,
  durationMinutes,
  workout,
  templateId = null,
  intensityTier = null,
  defaultType = 'workout',
  allowedTypes,
  campaignId = null,
  lockRecipientUserId = null,
  recipientIsFriend = true,
  defaultPostInChat = false,
  defaultIncludeSquadInvite = false,
}: SendInvitationFlowProps) {
  const typeOptions = allowedTypes ?? (['workout'] satisfies InvitationType[]);
  const [audience, setAudience] = useState<InvitationAudience | null>(null);
  const [type, setType] = useState<InvitationType>(
    typeOptions.includes(defaultType) ? defaultType : (typeOptions[0] ?? 'workout')
  );
  const [selectedSquad, setSelectedSquad] = useState<Record<string, boolean>>(
    lockRecipientUserId ? { [lockRecipientUserId]: true } : {}
  );
  const [selectedMission, setSelectedMission] = useState<Record<string, boolean>>({});
  const [everyoneInMission, setEveryoneInMission] = useState(false);
  const [postInChat, setPostInChat] = useState(defaultPostInChat);
  const [includeSquadInvite, setIncludeSquadInvite] = useState(defaultIncludeSquadInvite);
  const [note, setNote] = useState('');
  const [pickedCampaignId, setPickedCampaignId] = useState(campaignId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(Boolean(open));
  const [clientRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void fetchInvitationAudience(sourceMissionId).then((result) => {
      if (cancelled) {
        return;
      }
      setLoadingAudience(false);
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Could not load people to send to.');
        setAudience(null);
        return;
      }
      setAudience(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourceMissionId]);

  const missionPeople = useMemo(
    () => (audience?.missionParticipants ?? []).filter((row) => !row.isSelf),
    [audience]
  );

  const selectedSquadIds = useMemo(() => {
    if (lockRecipientUserId) {
      return new Set([lockRecipientUserId]);
    }
    return new Set(
      Object.entries(selectedSquad)
        .filter(([, on]) => on)
        .map(([id]) => id)
    );
  }, [lockRecipientUserId, selectedSquad]);

  const squadCount = selectedSquadIds.size;

  const missionCount = useMemo(() => {
    if (lockRecipientUserId) {
      return 0;
    }
    const picked = everyoneInMission
      ? missionPeople
      : missionPeople.filter((person) => selectedMission[person.userId]);
    return picked.filter((person) => !selectedSquadIds.has(person.userId)).length;
  }, [everyoneInMission, lockRecipientUserId, missionPeople, selectedMission, selectedSquadIds]);

  const summary = invitationAudienceSummary({
    squadCount,
    missionCount,
    postInChat: postInChat && Boolean(sourceMissionId),
  });

  const resolvedCampaignId =
    campaignId ||
    pickedCampaignId ||
    (type === 'campaign' ? (audience?.campaigns[0]?.campaignId ?? '') : '');

  const canSend =
    (squadCount > 0 || missionCount > 0 || (postInChat && Boolean(sourceMissionId))) &&
    (type !== 'campaign' || Boolean(resolvedCampaignId)) &&
    (type !== 'mission' || Boolean(sourceMissionId)) &&
    (type !== 'workout' || workout.length > 0);

  async function handleSend() {
    if (!canSend) {
      setError('Pick at least one recipient.');
      return;
    }
    const recipientUserIds = new Set<string>();
    if (lockRecipientUserId) {
      recipientUserIds.add(lockRecipientUserId);
    } else {
      for (const [id, on] of Object.entries(selectedSquad)) {
        if (on) {
          recipientUserIds.add(id);
        }
      }
      if (!everyoneInMission) {
        for (const [id, on] of Object.entries(selectedMission)) {
          if (on) {
            recipientUserIds.add(id);
          }
        }
      }
    }

    const needsSquadBundle =
      includeSquadInvite || Boolean(lockRecipientUserId && !recipientIsFriend);

    setBusy(true);
    setError(null);
    const result = await createInvitation({
      type,
      recipientUserIds: [...recipientUserIds],
      includeAllMissionParticipants: everyoneInMission && !lockRecipientUserId,
      postInChat: postInChat && Boolean(sourceMissionId),
      includeSquadInvite: needsSquadBundle,
      note,
      targetMissionId: type === 'mission' ? sourceMissionId : null,
      targetCampaignId: type === 'campaign' ? resolvedCampaignId || null : null,
      sourceMissionId,
      durationMinutes: type === 'workout' ? durationMinutes : null,
      workout: type === 'workout' ? workout : null,
      templateId: type === 'workout' ? templateId : null,
      intensityTier: type === 'workout' ? intensityTier : null,
      clientRequestId,
    });
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    const sent =
      result.data.deliveryCount > 0
        ? `Sent to ${result.data.deliveryCount} ${result.data.deliveryCount === 1 ? 'person' : 'people'}.`
        : 'Posted in chat.';
    onSent?.(sent);
    onClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-invitation-title"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="send-invitation-title" className="text-display text-xl text-ink">
          Send invitation
        </h2>

        {typeOptions.length > 1 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">What to send</legend>
            {typeOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="invitation-type"
                  checked={type === option}
                  onChange={() => setType(option)}
                />
                {sendInvitationTypeLabel(
                  option,
                  durationMinutes,
                  audience?.campaigns.find((row) => row.campaignId === resolvedCampaignId)
                    ?.weekCount ??
                    audience?.campaigns[0]?.weekCount ??
                    null
                )}
              </label>
            ))}
          </fieldset>
        ) : null}

        {type === 'campaign' && !campaignId ? (
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-ink">Campaign</span>
            <select
              className="input-field"
              value={resolvedCampaignId}
              onChange={(event) => setPickedCampaignId(event.target.value)}
            >
              <option value="">Pick a campaign…</option>
              {(audience?.campaigns ?? []).map((campaign) => (
                <option key={campaign.campaignId} value={campaign.campaignId}>
                  {campaign.name} · {campaign.weekCount}-week
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {lockRecipientUserId ? (
          <p className="text-sm text-secondary">
            Sending to this athlete
            {!recipientIsFriend ? ' · also invites them to your squad' : ''}.
          </p>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Your squad</legend>
              {loadingAudience ? (
                <p className="text-xs text-muted">Loading…</p>
              ) : (audience?.squad.length ?? 0) === 0 ? (
                <p className="text-xs text-muted">
                  Your squad is empty. Add someone on the Squad page first.
                </p>
              ) : (
                audience?.squad.map((friend) => (
                  <label key={friend.userId} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSquad[friend.userId])}
                      onChange={(event) =>
                        setSelectedSquad((current) => ({
                          ...current,
                          [friend.userId]: event.target.checked,
                        }))
                      }
                    />
                    {friend.nickname}
                  </label>
                ))
              )}
            </fieldset>

            {sourceMissionId ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">People in this mission</legend>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={everyoneInMission}
                    onChange={(event) => setEveryoneInMission(event.target.checked)}
                  />
                  Everyone currently in this mission
                </label>
                {!everyoneInMission
                  ? missionPeople.map((person) => (
                      <label
                        key={person.userId}
                        className="flex items-center gap-2 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedMission[person.userId])}
                          onChange={(event) =>
                            setSelectedMission((current) => ({
                              ...current,
                              [person.userId]: event.target.checked,
                            }))
                          }
                        />
                        {person.nickname}
                        {!person.isFriend ? (
                          <span className="text-xs text-muted">Not on your squad</span>
                        ) : null}
                      </label>
                    ))
                  : null}
              </fieldset>
            ) : null}
          </>
        )}

        {sourceMissionId ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={postInChat}
              onChange={(event) => setPostInChat(event.target.checked)}
            />
            Post in mission chat
          </label>
        ) : null}

        {!lockRecipientUserId && sourceMissionId ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeSquadInvite}
              onChange={(event) => setIncludeSquadInvite(event.target.checked)}
            />
            Invite to squad as well (for people who are not yet friends)
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink">
            A note <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            className="input-field"
            value={note}
            maxLength={200}
            placeholder="Join me for this one."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <p className="text-sm text-secondary">{summary}</p>
        {error ? <p className="alert-error">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy || !canSend}
            onClick={() => void handleSend()}
          >
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
          <button type="button" className="btn-outline text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface SendInvitationButtonProps extends SendInvitationContext {
  triggerLabel?: string;
  triggerClassName?: string;
  ready?: boolean;
  ensureWorkout?: () => Promise<WorkoutExercise[] | null>;
  onSent?: (summary: string) => void;
}

export function SendInvitationButton({
  triggerLabel = 'Send invitation',
  triggerClassName = 'btn-outline text-sm font-semibold',
  ready = true,
  ensureWorkout,
  onSent,
  ...context
}: SendInvitationButtonProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydratedWorkout, setHydratedWorkout] = useState<WorkoutExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workout = hydratedWorkout && hydratedWorkout.length > 0 ? hydratedWorkout : context.workout;

  if (sent) {
    return (
      <p className="text-sm text-secondary">
        {sent}{' '}
        <button
          type="button"
          className="link-accent"
          onClick={() => {
            setSent(null);
            setOpen(true);
          }}
        >
          Send another
        </button>
      </p>
    );
  }

  return (
    <>
      {error ? <p className="alert-error">{error}</p> : null}
      <button
        type="button"
        className={triggerClassName}
        disabled={!ready || busy}
        onClick={() => {
          void (async () => {
            if (workout.length === 0 && ensureWorkout) {
              setBusy(true);
              setError(null);
              const loaded = await ensureWorkout();
              setBusy(false);
              if (!loaded || loaded.length === 0) {
                setError('Could not load this workout. Please try again.');
                return;
              }
              setHydratedWorkout(loaded);
            }
            setOpen(true);
          })();
        }}
      >
        {busy ? 'Loading…' : triggerLabel}
      </button>
      <SendInvitationFlow
        key={open ? 'open' : 'closed'}
        {...context}
        workout={workout}
        open={open}
        onClose={() => setOpen(false)}
        onSent={(summary) => {
          setSent(summary);
          onSent?.(summary);
        }}
      />
    </>
  );
}
