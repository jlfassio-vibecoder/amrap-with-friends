import { useEffect, useRef, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import {
  fetchCampaignInvitePreview,
  joinCampaign,
  type CampaignInvitePreview,
} from '@/lib/api/campaigns';
import { formatCampaignShape, formatCampaignSpan } from '@/lib/campaign';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEnsureAthleteIdentity } from '@/hooks/useEnsureAthleteIdentity';
import { isIntakeRequiredMessage } from '@/lib/auth/profileNeedsIntake';

export default function JoinCampaignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = (searchParams.get('c') ?? '').trim();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { loading: profileLoading } = useAthleteProfile();
  const { ensureThen, overlay: identityOverlay } = useEnsureAthleteIdentity({
    acceptLabel: 'Accept & join',
  });

  const [preview, setPreview] = useState<CampaignInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [authOpenMode, setAuthOpenMode] = useState<'sign-in' | 'sign-up' | null>(null);
  const joinAfterAuthRef = useRef(false);
  const intakeRetryRef = useRef(false);

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    let cancelled = false;
    fetchCampaignInvitePreview(inviteCode).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'That campaign is not available.');
      } else {
        setPreview(result.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function performJoin() {
    setJoining(true);
    setError(null);
    const result = await joinCampaign(inviteCode);
    setJoining(false);

    if (result.error && isIntakeRequiredMessage(result.error.message) && !intakeRetryRef.current) {
      intakeRetryRef.current = true;
      ensureThen(() => {
        void performJoin();
      });
      return;
    }

    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    navigate(`/campaign/${result.data.campaignId}`);
  }

  function handleJoin() {
    intakeRetryRef.current = false;
    ensureThen(() => {
      void performJoin();
    });
  }

  useEffect(() => {
    if (!joinAfterAuthRef.current || !isAuthenticated || isAuthLoading || profileLoading) {
      return;
    }
    joinAfterAuthRef.current = false;
    setAuthOpenMode(null);
    handleJoin();
  }, [isAuthenticated, isAuthLoading, profileLoading]);

  if (!inviteCode) {
    return (
      <NarrowPageLayout title="Join a campaign" subtitle="You’ve been invited">
        <p className="text-error">That invite link is not valid.</p>
        <p className="text-center text-sm">
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </NarrowPageLayout>
    );
  }

  if (loading) {
    return (
      <NarrowPageLayout title="Join a campaign" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Loading the invite…</p>
      </NarrowPageLayout>
    );
  }

  if (!preview) {
    return (
      <NarrowPageLayout title="Join a campaign" subtitle="You’ve been invited">
        <p className="text-error">{error ?? 'That campaign is not available.'}</p>
        <p className="text-center text-sm">
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </NarrowPageLayout>
    );
  }

  const closed = preview.status === 'complete' || preview.status === 'abandoned';
  const full = preview.memberCount >= preview.memberLimit;
  const signedIn = !isAuthLoading && isAuthenticated;

  return (
    <NarrowPageLayout title="Join a campaign" subtitle="You’ve been invited">
      <section className="card space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-display text-3xl text-ink">{preview.name}</h2>
          <p className="text-sm text-secondary">
            {formatCampaignShape(preview.weekCount, preview.missionsPerWeek)}
            {preview.firstMissionDate && preview.lastMissionDate
              ? ` · ${formatCampaignSpan(preview.firstMissionDate, preview.lastMissionDate)}`
              : ''}
          </p>
        </div>

        {preview.goal ? <p className="text-sm text-secondary">{preview.goal}</p> : null}

        <p className="text-sm text-secondary">
          {preview.hostNickname ? `Hosted by ${preview.hostNickname}. ` : ''}
          {preview.memberCount === 1
            ? '1 person is in so far.'
            : `${preview.memberCount} people are in so far.`}
        </p>

        {closed ? (
          <p className="alert-error">This campaign has already finished.</p>
        ) : full ? (
          <p className="alert-error">This campaign is full.</p>
        ) : signedIn ? (
          <button
            type="button"
            className="btn-primary"
            disabled={joining}
            onClick={() => void handleJoin()}
          >
            {joining ? 'Joining…' : 'Join campaign'}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              Sign in to join. A campaign runs for weeks, so it tracks your missions against your
              account.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  joinAfterAuthRef.current = true;
                  setAuthOpenMode('sign-in');
                }}
              >
                Sign in to join
              </button>
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  joinAfterAuthRef.current = true;
                  setAuthOpenMode('sign-up');
                }}
              >
                Create account
              </button>
            </div>
          </div>
        )}

        {error ? <p className="alert-error">{error}</p> : null}
      </section>

      {authOpenMode ? (
        <AuthModal
          onClose={() => {
            joinAfterAuthRef.current = false;
            setAuthOpenMode(null);
          }}
          initialPasswordMode={authOpenMode}
          onAuthenticated={() => {
            joinAfterAuthRef.current = true;
            setAuthOpenMode(null);
          }}
          guestAllowed={false}
        />
      ) : null}
      {identityOverlay}

      <p className="text-center text-sm">
        <AppLink className="link-accent" to="/">
          Back home
        </AppLink>
      </p>
    </NarrowPageLayout>
  );
}
