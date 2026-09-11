import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { InvitationCard } from '@/components/invitations/InvitationCard';
import { SendInvitationButton } from '@/components/invitations/SendInvitationFlow';
import {
  acceptInvitation,
  acceptInvitationSquad,
  fetchInvitationPreview,
  saveChatInvitation,
  type InvitationCardData,
} from '@/lib/api/invitations';
import {
  mapSendMessageReason,
  sendMessage,
  validateMessageBody,
  MESSAGE_MAX_LENGTH,
} from '@/lib/api/sendMessage';
import {
  isStandaloneInvitationLink,
  parseInvitationLink,
  type ParsedInvitationLink,
} from '@/lib/invitations/parseInvitationLink';
import {
  markPendingInvitationSave,
  takePendingInvitationSave,
} from '@/lib/invitations/pendingInvitationSave';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type { LiveMissionPhase, MessageRow } from '@/lib/missionSync/types';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';

interface MissionChatProps {
  missionId: string;
  participantId: string;
  claimToken: string | null;
  isAuthenticated: boolean;
  messages: MessageRow[];
  className?: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  durationMinutes?: number;
  workout?: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  phase?: LiveMissionPhase;
  onRequestSignIn?: () => void;
}

function ChatInvitationMessage({
  invitationId,
  missionId,
  participantId,
  claimToken,
  isAuthenticated,
  viewerUserId,
  nickname,
  onRequestSignIn,
}: {
  invitationId: string;
  missionId: string;
  participantId: string;
  claimToken: string | null;
  isAuthenticated: boolean;
  viewerUserId: string | null;
  nickname: string;
  onRequestSignIn?: () => void;
}) {
  const [card, setCard] = useState<InvitationCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchInvitationPreview({
      invitationId,
      sourceMissionId: missionId,
      participantId,
      claimToken,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'That invitation is no longer available.');
        return;
      }
      setCard(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [invitationId, missionId, participantId, claimToken]);

  useEffect(() => {
    if (!isAuthenticated || !card) {
      return;
    }
    if (!takePendingInvitationSave(invitationId)) {
      return;
    }
    void saveChatInvitation(invitationId).then((result) => {
      const deliveryId = result.deliveryId;
      if (!result.error && deliveryId) {
        setCard((current) => (current ? { ...current, deliveryId } : current));
      }
    });
  }, [isAuthenticated, card, invitationId]);

  if (error) {
    return <p className="text-sm text-secondary">{error}</p>;
  }
  if (!card) {
    return <p className="text-sm text-secondary">Loading invitation…</p>;
  }

  return (
    <div className="space-y-2">
      <InvitationCard
        card={card}
        variant="chat"
        isAuthenticated={isAuthenticated}
        viewerUserId={viewerUserId}
        busy={busy}
        onPrimary={
          card.deliveryId
            ? () => {
                void (async () => {
                  setBusy(true);
                  setActionError(null);
                  const result = await acceptInvitation(card.deliveryId as string, nickname);
                  setBusy(false);
                  if (result.error || !result.data) {
                    setActionError(
                      result.error?.message ?? 'Something went wrong. Please try again.'
                    );
                    return;
                  }
                  if (result.data.missionId) {
                    window.location.assign(`/mission/${result.data.missionId}`);
                  }
                })();
              }
            : card.mission
              ? () => {
                  window.location.assign(`/mission/${card.mission?.id}`);
                }
              : undefined
        }
        onJoinCampaign={
          card.deliveryId
            ? () => {
                void (async () => {
                  setBusy(true);
                  setActionError(null);
                  const result = await acceptInvitation(card.deliveryId as string, nickname);
                  setBusy(false);
                  if (result.error || !result.data) {
                    setActionError(
                      result.error?.message ?? 'Something went wrong. Please try again.'
                    );
                    return;
                  }
                  if (result.data.campaignId) {
                    window.location.assign(`/campaign/${result.data.campaignId}`);
                  }
                })();
              }
            : undefined
        }
        onAcceptSquad={
          card.deliveryId && card.squadRequestId
            ? () => {
                void (async () => {
                  setBusy(true);
                  setActionError(null);
                  const result = await acceptInvitationSquad(card.deliveryId as string);
                  setBusy(false);
                  if (result.error) {
                    setActionError(result.error.message);
                    return;
                  }
                  setCard((current) =>
                    current ? { ...current, squadStatus: 'accepted' } : current
                  );
                })();
              }
            : undefined
        }
        onSaveToInbox={() => {
          void (async () => {
            setBusy(true);
            setActionError(null);
            const result = await saveChatInvitation(invitationId);
            setBusy(false);
            const deliveryId = result.deliveryId;
            if (result.error || !deliveryId) {
              setActionError(result.error?.message ?? 'Could not save that invitation.');
              return;
            }
            setCard((current) => (current ? { ...current, deliveryId } : current));
          })();
        }}
        onSignInToSave={() => {
          markPendingInvitationSave(invitationId);
          onRequestSignIn?.();
        }}
      />
      {actionError ? <p className="text-error text-sm">{actionError}</p> : null}
    </div>
  );
}

export function MissionChat({
  missionId,
  participantId,
  claimToken,
  isAuthenticated,
  messages,
  className,
  expanded,
  onExpandedChange,
  durationMinutes = 15,
  workout = [],
  templateId = null,
  intensityTier = null,
  phase = 'waiting',
  onRequestSignIn,
}: MissionChatProps) {
  const { profile } = useAthleteProfile();
  const { user } = useAmrapAuth();
  const nickname = profile?.nickname?.trim() || 'Athlete';
  const viewerUserId = isAuthenticated ? (user?.id ?? null) : null;
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkPrompt, setLinkPrompt] = useState(false);
  const [pastedKind, setPastedKind] = useState<ParsedInvitationLink['kind'] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const allowedTypes = useMemo(() => {
    if (phase === 'finished') {
      return ['workout', 'campaign'] as const;
    }
    return ['mission', 'workout', 'campaign'] as const;
  }, [phase]);

  useEffect(() => {
    if (!expanded) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [expanded, messages.length]);

  const pasteDefaultType =
    pastedKind === 'campaign' || pastedKind === 'campaign_id'
      ? 'campaign'
      : phase === 'finished'
        ? 'workout'
        : 'mission';

  async function sendChatBody(body: string) {
    const tokenForRpc = claimToken ?? '';
    if (!tokenForRpc && !isAuthenticated) {
      setError('Could not send message. Rejoin from this device if you still have access.');
      return;
    }

    setIsSending(true);

    const result = await sendMessage({
      missionId,
      participantId,
      claimToken: tokenForRpc,
      body,
    });

    setIsSending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data?.ok === false) {
      setError(mapSendMessageReason(result.data.reason));
      return;
    }

    setInput('');
    setLinkPrompt(false);
    setPastedKind(null);
    onExpandedChange(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (isStandaloneInvitationLink(input) && isAuthenticated) {
      setPastedKind(parseInvitationLink(input)?.kind ?? null);
      setLinkPrompt(true);
      return;
    }

    const validation = validateMessageBody(input);
    if (!validation.ok) {
      setError(mapSendMessageReason(validation.reason));
      return;
    }

    await sendChatBody(validation.body);
  }

  return (
    <section
      className={`card flex min-h-0 flex-col gap-3 overflow-hidden p-4 ${className ?? ''}`}
      data-walkthrough-id="chat"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-display text-sm text-ink lg:text-base">Chat</h2>
        <button
          type="button"
          className="text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-hover"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Close' : 'Open'}
        </button>
      </div>

      {expanded ? (
        <div
          ref={listRef}
          data-testid="mission-chat-message-list"
          className="max-h-48 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-card border border-divider bg-page p-3 text-sm lg:max-h-none"
        >
          {messages.length === 0 ? (
            <p className="text-secondary">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-0.5">
                <p className="text-xs text-muted">
                  {message.nickname} · {new Date(message.created_at).toLocaleTimeString()}
                </p>
                {message.attachment?.type === 'invitation' ? (
                  <ChatInvitationMessage
                    invitationId={message.attachment.invitation_id}
                    missionId={missionId}
                    participantId={participantId}
                    claimToken={claimToken}
                    isAuthenticated={isAuthenticated}
                    viewerUserId={viewerUserId}
                    nickname={nickname}
                    onRequestSignIn={onRequestSignIn}
                  />
                ) : (
                  <p>{message.body}</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {error ? <p className="text-error shrink-0 text-sm">Error: {error}</p> : null}

      {linkPrompt ? (
        <div className="space-y-2 rounded-card bg-surface-muted p-3">
          <p className="text-sm text-ink">Send this as an invitation instead of a raw link?</p>
          <div className="flex flex-wrap gap-2">
            <SendInvitationButton
              sourceMissionId={missionId}
              durationMinutes={durationMinutes}
              workout={workout}
              templateId={templateId}
              intensityTier={intensityTier}
              allowedTypes={[...allowedTypes]}
              defaultType={pasteDefaultType}
              defaultPostInChat
              triggerLabel="Send as invitation"
              triggerClassName="btn-primary text-sm"
              onSent={() => {
                setInput('');
                setLinkPrompt(false);
                setPastedKind(null);
              }}
            />
            <button
              type="button"
              className="btn-outline text-sm"
              onClick={() => {
                const validation = validateMessageBody(input);
                setLinkPrompt(false);
                setPastedKind(null);
                if (!validation.ok) {
                  setError(mapSendMessageReason(validation.reason));
                  return;
                }
                void sendChatBody(validation.body);
              }}
            >
              Paste as text
            </button>
          </div>
        </div>
      ) : null}

      {isAuthenticated ? (
        <SendInvitationButton
          sourceMissionId={missionId}
          durationMinutes={durationMinutes}
          workout={workout}
          templateId={templateId}
          intensityTier={intensityTier}
          allowedTypes={[...allowedTypes]}
          defaultType={phase === 'finished' ? 'workout' : 'mission'}
          defaultPostInChat
          triggerLabel="Share a workout or invitation"
          triggerClassName="text-sm font-semibold text-accent hover:text-accent-hover"
        />
      ) : null}

      <form className="flex shrink-0 gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          className="input-field min-w-0 flex-1 text-sm"
          placeholder="Type a message…"
          value={input}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={isSending}
          onChange={(event) => {
            setInput(event.target.value);
            if (linkPrompt) {
              setLinkPrompt(false);
              setPastedKind(null);
            }
          }}
        />
        <button type="submit" className="btn-neutral text-sm" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
