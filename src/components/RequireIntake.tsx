import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { IdentityOverlay } from '@/components/onboarding/IdentityOverlay';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { profileNeedsIntake } from '@/lib/auth/profileNeedsIntake';
import type { PasswordMode } from '@/components/AuthForm';

interface RequireIntakeProps {
  children: ReactNode;
  guestMode: 'sign-in' | 'passthrough';
  /** Rendered above the sign-in prompt when guestMode is 'sign-in' and the
   * visitor isn't authenticated — for content that should stay visible even
   * behind the gate (e.g. a public Featured WOD preview). */
  signedOutPreview?: ReactNode;
  /** Title on the signed-out gate. Defaults to the create-mission wording. */
  gateTitle?: string;
  /** Explains what signing in unlocks here, so the gate matches the route. */
  gateMessage?: string;
  /** False where the route genuinely needs an account, so the auth modal does
   * not offer guest play the gate has already ruled out. */
  gateAllowsGuest?: boolean;
  /** HUD keeps the /intake redirect; campaign/squad host gates use the overlay. */
  identityGate?: 'overlay' | 'redirect';
}

export function RequireIntake({
  children,
  guestMode,
  signedOutPreview,
  gateTitle = 'Create mission',
  gateMessage = 'Sign in and set up your profile before creating a mission. You can still join as a guest.',
  gateAllowsGuest = true,
  identityGate = 'overlay',
}: RequireIntakeProps) {
  const location = useLocation();
  const { profile, missing, loading, isAuthenticated, isAuthLoading, error, saveIdentity } =
    useAthleteProfile();
  const [authOpenMode, setAuthOpenMode] = useState<PasswordMode | null>('sign-in');

  if (isAuthLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  if (!isAuthenticated) {
    if (guestMode === 'passthrough') {
      return children;
    }

    return (
      <NarrowPageLayout title={gateTitle} subtitle="Sign in required">
        {signedOutPreview}
        <p className="text-sm text-secondary">{gateMessage}</p>
        {authOpenMode ? (
          <AuthModal
            onClose={() => setAuthOpenMode(null)}
            guestAllowed={gateAllowsGuest}
            initialPasswordMode={authOpenMode}
          />
        ) : null}
        {!authOpenMode ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAuthOpenMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => setAuthOpenMode('sign-up')}
            >
              Create account
            </button>
          </div>
        ) : null}
      </NarrowPageLayout>
    );
  }

  if (error) {
    return (
      <NarrowPageLayout title="Your profile" subtitle="Edit profile / HUD metrics">
        <p className="text-error">Error: {error}</p>
      </NarrowPageLayout>
    );
  }

  if (profileNeedsIntake(profile, missing)) {
    if (identityGate === 'redirect') {
      const next = `${location.pathname}${location.search}`;
      return <Navigate to={`/intake?next=${encodeURIComponent(next)}`} replace />;
    }

    // Do not mount gated children until identity exists — otherwise pages like
    // SquadPage call intake-gated RPCs and stick on a dead-end error.
    return (
      <>
        <NarrowPageLayout title={gateTitle} subtitle="Your name">
          <p className="text-sm text-secondary">{gateMessage}</p>
        </NarrowPageLayout>
        <IdentityOverlay
          acceptLabel="Continue"
          dismissible={false}
          onClose={() => undefined}
          onAccept={saveIdentity}
        />
      </>
    );
  }

  return children;
}
