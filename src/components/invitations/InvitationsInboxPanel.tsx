import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InvitationCard } from '@/components/invitations/InvitationCard';
import {
  acceptInvitation,
  acceptInvitationSquad,
  blockInvitationSender,
  dismissInvitation,
  fetchMyInvitations,
  markInvitationsRead,
  type InvitationCardData,
} from '@/lib/api/invitations';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';

interface InvitationsInboxPanelProps {
  showWhenEmpty?: boolean;
  onUnreadChange?: (count: number) => void;
}

export function InvitationsInboxPanel({
  showWhenEmpty = false,
  onUnreadChange,
}: InvitationsInboxPanelProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const [pending, setPending] = useState<InvitationCardData[]>([]);
  const [resolved, setResolved] = useState<InvitationCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchMyInvitations>>) => {
      if (result.error) {
        setError(result.error.message);
        setPending([]);
        setResolved([]);
        onUnreadChange?.(0);
      } else {
        setError(null);
        setPending(result.pending);
        setResolved(result.resolved);
        onUnreadChange?.(result.unreadCount);
      }
      setLoading(false);
    },
    [onUnreadChange]
  );

  const load = useCallback(() => {
    return fetchMyInvitations().then(applyResult);
  }, [applyResult]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    void fetchMyInvitations().then((result) => {
      if (cancelled) {
        return;
      }
      applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, applyResult]);

  useRefetchOnVisible(Boolean(isAuthenticated && !isAuthLoading), load);

  useEffect(() => {
    if (!isAuthenticated || pending.length === 0) {
      return;
    }
    const unreadIds = pending
      .filter((row) => row.deliveryId && !row.readAt)
      .map((row) => row.deliveryId as string);
    if (unreadIds.length === 0) {
      return;
    }
    void markInvitationsRead(unreadIds).then((result) => {
      if (!result.error) {
        onUnreadChange?.(0);
      }
    });
  }, [isAuthenticated, pending, onUnreadChange]);

  async function handlePrimary(card: InvitationCardData) {
    if (!card.deliveryId) {
      return;
    }
    setBusyId(card.deliveryId);
    setError(null);
    const result = await acceptInvitation(card.deliveryId, profile?.nickname?.trim() || 'Athlete');
    setBusyId(null);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      await load();
      return;
    }
    if (result.data.missionId) {
      navigate(`/mission/${result.data.missionId}`);
      return;
    }
    if (result.data.campaignId) {
      navigate(`/campaign/${result.data.campaignId}`);
      return;
    }
    await load();
  }

  async function handleJoinCampaign(card: InvitationCardData) {
    await handlePrimary(card);
  }

  async function handleAcceptSquad(card: InvitationCardData) {
    if (!card.deliveryId) {
      return;
    }
    setBusyId(card.deliveryId);
    setError(null);
    const result = await acceptInvitationSquad(card.deliveryId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  async function handleDismiss(card: InvitationCardData) {
    if (!card.deliveryId) {
      return;
    }
    setBusyId(card.deliveryId);
    setError(null);
    const result = await dismissInvitation(card.deliveryId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  async function handleBlock(card: InvitationCardData) {
    setBusyId(card.deliveryId ?? card.invitationId);
    setError(null);
    const result = await blockInvitationSender(card.fromUserId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  if (isAuthLoading || !isAuthenticated) {
    return null;
  }
  if (!showWhenEmpty && !loading && !error && pending.length === 0 && resolved.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-display text-xl text-ink">Sent to you</h2>
        <p className="text-sm text-secondary">
          Invitations and workouts from your squad. Opening one does not accept it.
        </p>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
      {error ? <p className="alert-error">{error}</p> : null}

      {!loading && !error && pending.length === 0 ? (
        <p className="text-sm text-secondary">Nothing waiting.</p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((card) => (
            <li key={card.deliveryId ?? card.invitationId}>
              <InvitationCard
                card={card}
                busy={busyId === card.deliveryId}
                onPrimary={() => void handlePrimary(card)}
                onJoinCampaign={() => void handleJoinCampaign(card)}
                onAcceptSquad={card.squadRequestId ? () => void handleAcceptSquad(card) : undefined}
                onDismiss={() => void handleDismiss(card)}
                onBlock={() => void handleBlock(card)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {resolved.length > 0 ? (
        <div className="space-y-2 border-t border-divider pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Recently resolved
          </h3>
          <ul className="space-y-2">
            {resolved.map((card) => (
              <li key={card.deliveryId ?? card.invitationId} className="text-sm text-secondary">
                {card.fromNickname}
                {card.status === 'accepted' ? ' · Accepted' : null}
                {card.status === 'dismissed' ? ' · Dismissed' : null}
                {card.status === 'unavailable' ? ' · Unavailable' : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
