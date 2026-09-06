import { useEffect, useState, type ReactNode } from 'react';
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

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AuthHeaderActions({ tone = 'default' }: { tone?: HeaderTone }) {
  const { isAuthenticated, isAuthLoading, user, signOut } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpenMode, setAuthOpenMode] = useState<AuthOpenMode | null>(null);
  const [openedAsSignUp, setOpenedAsSignUp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const accountLabel = profile?.username?.trim() || user?.email || null;
  const toneClasses = HEADER_TONE_CLASSES[tone];
  const night = tone === 'night';

  const menuButtonClassName = night
    ? 'text-night-secondary hover:bg-night-border hover:text-night-ink'
    : 'text-secondary hover:bg-accent-tint hover:text-ink';

  const drawerPanelClassName = night
    ? 'border-night-border bg-night text-night-ink'
    : 'border-border bg-surface text-ink';

  const drawerTitleClassName = night ? 'text-night-ink' : 'text-ink';
  const drawerCloseClassName = night
    ? 'text-night-secondary hover:text-night-ink'
    : 'text-secondary hover:text-ink';

  function closeMenu() {
    setMenuOpen(false);
  }

  function openAuth(mode: AuthOpenMode) {
    closeMenu();
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

  function handleSignOut() {
    closeMenu();
    void signOut();
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const authenticatedLinks = (layout: 'inline' | 'stack'): ReactNode => {
    const linkClass =
      layout === 'stack' ? `block py-2 text-base ${toneClasses.link}` : toneClasses.link;
    const mutedClass =
      layout === 'stack' ? `block py-2 text-base ${toneClasses.mutedLink}` : toneClasses.mutedLink;
    const buttonClass =
      layout === 'stack'
        ? `block w-full py-2 text-left text-base ${toneClasses.link}`
        : toneClasses.link;

    return (
      <>
        <Link className={linkClass} to="/hud" onClick={closeMenu}>
          HUD
        </Link>
        <Link className={linkClass} to="/squad" onClick={closeMenu}>
          Squad
        </Link>
        <Link className={linkClass} to="/my-missions" onClick={closeMenu}>
          My missions
        </Link>
        {accountLabel ? (
          <Link className={mutedClass} to="/intake" onClick={closeMenu}>
            {accountLabel}
          </Link>
        ) : null}
        <button type="button" className={buttonClass} onClick={handleSignOut}>
          Sign out
        </button>
      </>
    );
  };

  const guestActions = (layout: 'inline' | 'stack'): ReactNode => {
    const buttonClass =
      layout === 'stack'
        ? `block w-full py-2 text-left text-base ${toneClasses.link}`
        : toneClasses.link;

    return (
      <>
        <button type="button" className={buttonClass} onClick={() => openAuth('sign-in')}>
          Sign in
        </button>
        <button type="button" className={buttonClass} onClick={() => openAuth('sign-up')}>
          Create account
        </button>
      </>
    );
  };

  const authCluster = (layout: 'inline' | 'stack'): ReactNode => {
    if (isAuthLoading) {
      return <span className={`text-sm ${toneClasses.muted}`}>…</span>;
    }
    if (isAuthenticated) {
      return authenticatedLinks(layout);
    }
    return guestActions(layout);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <ThemeToggle tone={tone} />
        <div className="hidden items-center gap-3 text-sm lg:flex">{authCluster('inline')}</div>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-card p-2 lg:hidden ${menuButtonClassName}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon />
        </button>
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-scrim lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={closeMenu}
        >
          <div
            className={`absolute inset-y-0 right-0 flex w-full max-w-[20rem] flex-col border-l shadow-card ${drawerPanelClassName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-inherit px-5 py-4">
              <p className={`text-display text-lg ${drawerTitleClassName}`}>Menu</p>
              <button
                type="button"
                className={`text-sm ${drawerCloseClassName}`}
                onClick={closeMenu}
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-5 py-4">{authCluster('stack')}</nav>
          </div>
        </div>
      ) : null}

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
