import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';

interface RequireIntakeProps {
  children: ReactNode;
  guestMode: 'sign-in' | 'passthrough';
  /** Rendered above the sign-in prompt when guestMode is 'sign-in' and the
   * visitor isn't authenticated — for content that should stay visible even
   * behind the gate (e.g. a public Featured WOD preview). */
  signedOutPreview?: ReactNode;
  /** Title on the signed-out gate. Defaults to the create-session wording. */
  gateTitle?: string;
  /** Explains what signing in unlocks here, so the gate matches the route. */
  gateMessage?: string;
  /** False where the route genuinely needs an account, so the auth modal does
   * not offer guest play the gate has already ruled out. */
  gateAllowsGuest?: boolean;
}

export function RequireIntake({
  children,
  guestMode,
  signedOutPreview,
  gateTitle = 'Create session',
  gateMessage = 'Sign in and set up your profile before creating a session. You can still join as a guest.',
  gateAllowsGuest = true,
}: RequireIntakeProps) {
  const location = useLocation();
  const { profile, missing, loading, isAuthenticated, isAuthLoading, error } =
    useAthleteProfile();
  const [authOpen, setAuthOpen] = useState(true);

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
        {authOpen ? (
          <AuthModal onClose={() => setAuthOpen(false)} guestAllowed={gateAllowsGuest} />
        ) : null}
        {!authOpen ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        ) : null}
      </NarrowPageLayout>
    );
  }

  if (error) {
    return (
      <NarrowPageLayout title="Your profile" subtitle="Athlete details">
        <p className="text-error">Error: {error}</p>
      </NarrowPageLayout>
    );
  }

  if (missing || !profile || !profile.username.trim() || !profile.nickname.trim()) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/intake?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
