import { useEffect, useRef, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import {
  acceptSquadInviteCode,
  fetchSquadInvitePreview,
  type SquadInvitePreview,
} from '@/lib/api/squad';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEnsureAthleteIdentity } from '@/hooks/useEnsureAthleteIdentity';
import { isIntakeRequiredMessage } from '@/lib/auth/profileNeedsIntake';

export default function JoinSquadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = (searchParams.get('c') ?? '').trim();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { loading: profileLoading } = useAthleteProfile();
  const { ensureThen, overlay: identityOverlay } = useEnsureAthleteIdentity({
    acceptLabel: 'Accept & join',
  });

  const [preview, setPreview] = useState<SquadInvitePreview | null>(null);
  const [loadedCode, setLoadedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [authOpenMode, setAuthOpenMode] = useState<'sign-in' | 'sign-up' | null>(null);
  const joinAfterAuthRef = useRef(false);
  const intakeRetryRef = useRef(false);

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    let cancelled = false;
    fetchSquadInvitePreview(inviteCode).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'That invite is not available.');
        setPreview(null);
      } else {
        setError(null);
        setPreview(result.data);
      }
      setLoadedCode(inviteCode);
    });

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function performAccept() {
    setAccepting(true);
    setError(null);
    const result = await acceptSquadInviteCode(inviteCode);
    setAccepting(false);
    if (result.error && isIntakeRequiredMessage(result.error.message) && !intakeRetryRef.current) {
      intakeRetryRef.current = true;
      ensureThen(() => {
        void performAccept();
      });
      return;
    }
    if (result.error) {
      setError(result.error.message);
      return;
    }
    navigate('/squad');
  }

  function handleAccept() {
    intakeRetryRef.current = false;
    ensureThen(() => {
      void performAccept();
    });
  }

  useEffect(() => {
    if (!joinAfterAuthRef.current || !isAuthenticated || isAuthLoading || profileLoading) {
      return;
    }
    joinAfterAuthRef.current = false;
    setAuthOpenMode(null);
    handleAccept();
  }, [isAuthenticated, isAuthLoading, profileLoading]);

  if (!inviteCode) {
    return (
      <NarrowPageLayout title="Your squad" subtitle="You’ve been invited">
        <p className="text-error">That invite link is not valid.</p>
        <p className="text-center text-sm">
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </NarrowPageLayout>
    );
  }

  // Treat a mismatched loaded code as loading so a new ?c= never flashes the
  // previous inviter while the next preview is in flight.
  const loading = loadedCode !== inviteCode;

  if (loading) {
    return (
      <NarrowPageLayout title="Your squad" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Loading the invite…</p>
      </NarrowPageLayout>
    );
  }

  if (!preview) {
    return (
      <NarrowPageLayout title="Your squad" subtitle="You’ve been invited">
        <p className="text-error">{error ?? 'That invite is not available.'}</p>
        <p className="text-center text-sm">
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </NarrowPageLayout>
    );
  }

  const signedIn = !isAuthLoading && isAuthenticated;
  const inviter = preview.nickname ?? preview.username ?? 'An athlete';

  return (
    <NarrowPageLayout title="Your squad" subtitle="You’ve been invited">
      <section className="card space-y-4 p-6">
        <h2 className="text-display text-3xl text-ink">{inviter} invited you</h2>
        <p className="text-sm text-secondary">
          Accept to add them to your squad. You will need an account — a squad tracks people, not
          one mission.
        </p>

        {signedIn ? (
          <button
            type="button"
            className="btn-primary"
            disabled={accepting}
            onClick={() => void handleAccept()}
          >
            {accepting ? 'Accepting…' : 'Accept'}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              Sign in to accept. If you do not have an account yet, create one first.
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
