import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { AuthModal } from '@/components/AuthModal';

export function AuthHeaderActions() {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (isAuthLoading) {
    return <span className="text-sm text-muted">…</span>;
  }

  return (
    <>
      {isAuthenticated ? (
        <div className="flex items-center gap-3 text-sm">
          <Link className="link-accent" to="/my-sessions">My sessions</Link>
          <span className="text-secondary">{user?.email}</span>
          <button type="button" className="link-accent" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="link-accent text-sm"
          onClick={() => setAuthOpen(true)}
        >
          Sign in
        </button>
      )}
      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </>
  );
}
