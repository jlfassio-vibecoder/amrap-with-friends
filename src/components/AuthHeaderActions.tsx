import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { AuthModal } from '@/components/AuthModal';
import { ThemeToggle } from '@/components/ThemeToggle';

type AuthOpenMode = 'sign-in' | 'sign-up';

export function AuthHeaderActions() {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const [authOpenMode, setAuthOpenMode] = useState<AuthOpenMode | null>(null);

  const accountLabel =
    profile?.username?.trim() || user?.email || null;

  return (
    <>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {isAuthLoading ? (
          <span className="text-sm text-muted">…</span>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-3 text-sm">
            <Link className="link-accent" to="/hud">
              HUD
            </Link>
            <Link className="link-accent" to="/my-sessions">
              My sessions
            </Link>
            {accountLabel ? (
              <Link className="text-secondary hover:text-accent" to="/intake">
                {accountLabel}
              </Link>
            ) : null}
            <button type="button" className="link-accent" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              className="link-accent"
              onClick={() => setAuthOpenMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="link-accent"
              onClick={() => setAuthOpenMode('sign-up')}
            >
              Create account
            </button>
          </div>
        )}
      </div>
      {authOpenMode ? (
        <AuthModal
          onClose={() => setAuthOpenMode(null)}
          initialPasswordMode={authOpenMode}
        />
      ) : null}
    </>
  );
}
