import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { AuthModal } from '@/components/AuthModal';

export function AuthHeaderActions() {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (isAuthLoading) {
    return <span className="text-sm text-gray-500">…</span>;
  }

  return (
    <>
      {isAuthenticated ? (
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline" to="/my-sessions">My sessions</Link>
          <span className="text-gray-600">{user?.email}</span>
          <button type="button" className="underline" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setAuthOpen(true)}
        >
          Sign in
        </button>
      )}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
