import { useState, type ReactNode } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/** Sign-in gate for /coach. Authorization itself (coach_users allowlist) is enforced server-side by coach_dashboard()/coach_events_recent(); this only gates on being signed in at all. */
export function RequireCoach({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [authOpen, setAuthOpen] = useState(true);

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-secondary">
        Loading…
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <NarrowPageLayout title="Coach" subtitle="Sign in required">
        <p className="text-sm text-secondary">Sign in with a coach account to continue.</p>
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

  return children;
}
