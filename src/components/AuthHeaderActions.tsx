import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { AuthModal } from '@/components/AuthModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HEADER_TONE_CLASSES, type HeaderTone } from '@/components/headerTone';
import { isGuestOpenPath } from '@/lib/auth/guestOpenPaths';
import {
  clearPostAuthPathIntent,
  consumePostAuthPathIntent,
  resolvePostAuthDestination,
  setPostAuthPathIntent,
} from '@/lib/auth/postAuthDestination';
import type { PasswordMode } from '@/components/AuthForm';

type AuthOpenMode = PasswordMode;

export function AuthHeaderActions({ tone = 'default' }: { tone?: HeaderTone }) {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpenMode, setAuthOpenMode] = useState<AuthOpenMode | null>(null);
  const [openedAsSignUp, setOpenedAsSignUp] = useState(false);

  const accountLabel = profile?.username?.trim() || user?.email || null;
  const toneClasses = HEADER_TONE_CLASSES[tone];

  function openAuth(mode: AuthOpenMode) {
    setOpenedAsSignUp(mode === 'sign-up');
    if (mode === 'sign-up' && !isGuestOpenPath(location.pathname)) {
      setPostAuthPathIntent('/create');
    } else {
      clearPostAuthPathIntent();
    }
    setAuthOpenMode(mode);
  }

  function handleAuthenticated() {
    setAuthOpenMode(null);
    if (!openedAsSignUp) {
      clearPostAuthPathIntent();
      return;
    }
    if (isGuestOpenPath(location.pathname)) {
      clearPostAuthPathIntent();
      return;
    }
    const intent = consumePostAuthPathIntent();
    const destination = intent ?? resolvePostAuthDestination({ pathname: location.pathname });
    if (destination) {
      navigate(destination);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <ThemeToggle tone={tone} />
        {isAuthLoading ? (
          <span className={`text-sm ${toneClasses.muted}`}>…</span>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-3 text-sm">
            <Link className={toneClasses.link} to="/hud">
              HUD
            </Link>
            <Link className={toneClasses.link} to="/squad">
              Squad
            </Link>
            <Link className={toneClasses.link} to="/my-missions">
              My missions
            </Link>
            {accountLabel ? (
              <Link className={toneClasses.mutedLink} to="/intake">
                {accountLabel}
              </Link>
            ) : null}
            <button type="button" className={toneClasses.link} onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <button type="button" className={toneClasses.link} onClick={() => openAuth('sign-in')}>
              Sign in
            </button>
            <button type="button" className={toneClasses.link} onClick={() => openAuth('sign-up')}>
              Create account
            </button>
          </div>
        )}
      </div>
      {authOpenMode ? (
        <AuthModal
          onClose={() => {
            clearPostAuthPathIntent();
            setAuthOpenMode(null);
          }}
          initialPasswordMode={authOpenMode}
          onAuthenticated={handleAuthenticated}
        />
      ) : null}
    </>
  );
}
