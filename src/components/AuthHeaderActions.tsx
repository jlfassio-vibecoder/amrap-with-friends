import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { AuthModal } from '@/components/AuthModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HEADER_TONE_CLASSES, type HeaderTone } from '@/components/headerTone';
import { isGuestOpenPath } from '@/lib/auth/guestOpenPaths';
import type { PasswordMode } from '@/components/AuthForm';

type AuthOpenMode = PasswordMode;

function profileNeedsIntake(
  profile: {
    username: string;
    nickname: string;
  } | null
): boolean {
  if (!profile) {
    return true;
  }
  return !profile.username.trim() || !profile.nickname.trim();
}

export function AuthHeaderActions({ tone = 'default' }: { tone?: HeaderTone }) {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const { profile, missing } = useAthleteProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpenMode, setAuthOpenMode] = useState<AuthOpenMode | null>(null);
  const [openedAsSignUp, setOpenedAsSignUp] = useState(false);

  const accountLabel = profile?.username?.trim() || user?.email || null;
  const toneClasses = HEADER_TONE_CLASSES[tone];

  function openAuth(mode: AuthOpenMode) {
    setOpenedAsSignUp(mode === 'sign-up');
    setAuthOpenMode(mode);
  }

  function handleAuthenticated() {
    setAuthOpenMode(null);
    if (!openedAsSignUp) {
      return;
    }
    if (isGuestOpenPath(location.pathname)) {
      return;
    }
    if (missing || profileNeedsIntake(profile)) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/intake?next=${encodeURIComponent(next)}`);
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
          onClose={() => setAuthOpenMode(null)}
          initialPasswordMode={authOpenMode}
          onAuthenticated={handleAuthenticated}
        />
      ) : null}
    </>
  );
}
