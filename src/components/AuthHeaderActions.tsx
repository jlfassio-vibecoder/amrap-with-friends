import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { AuthModal } from '@/components/AuthModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HEADER_TONE_CLASSES, type HeaderTone } from '@/components/headerTone';

type AuthOpenMode = 'sign-in' | 'sign-up';

export function AuthHeaderActions({ tone = 'default' }: { tone?: HeaderTone }) {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const [authOpenMode, setAuthOpenMode] = useState<AuthOpenMode | null>(null);

  const accountLabel = profile?.username?.trim() || user?.email || null;
  const toneClasses = HEADER_TONE_CLASSES[tone];

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
            <Link className={toneClasses.link} to="/my-sessions">
              My sessions
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
            <button
              type="button"
              className={toneClasses.link}
              onClick={() => setAuthOpenMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={toneClasses.link}
              onClick={() => setAuthOpenMode('sign-up')}
            >
              Create account
            </button>
          </div>
        )}
      </div>
      {authOpenMode ? (
        <AuthModal onClose={() => setAuthOpenMode(null)} initialPasswordMode={authOpenMode} />
      ) : null}
    </>
  );
}
