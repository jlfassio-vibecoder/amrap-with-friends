import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';

interface RequireIntakeProps {
  children: ReactNode;
  guestMode: 'sign-in' | 'passthrough';
}

export function RequireIntake({ children, guestMode }: RequireIntakeProps) {
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
      <NarrowPageLayout title="Create session" subtitle="Sign in required">
        <p className="text-sm text-secondary">
          Sign in and complete intake before creating a session. You can still join
          as a guest.
        </p>
        {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
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
      <NarrowPageLayout title="Intake" subtitle="Dossier">
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
