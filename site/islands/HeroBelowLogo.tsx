import { useState } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  clearPostAuthPathIntent,
  consumePostAuthPathIntent,
  setPostAuthPathIntent,
} from '@/lib/auth/postAuthDestination';
import { HomeIsland } from './HomeIsland';

const CARD_CLASS = 'rounded-card border border-night-border bg-surface p-3 text-ink shadow-card';

/**
 * Homepage slot under the hero logo: inline sign-in for visitors, scheduled
 * missions for signed-in hosts.
 */
export default function HeroBelowLogo() {
  return (
    <HomeIsland>
      <HeroBelowLogoGate />
    </HomeIsland>
  );
}

function HeroBelowLogoGate() {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [holdSignupContinue, setHoldSignupContinue] = useState(false);
  const [pendingCreateRedirect, setPendingCreateRedirect] = useState(false);

  if (isAuthLoading) {
    return null;
  }

  const showAuthForm = !isAuthenticated || holdSignupContinue;

  return (
    <div className={CARD_CLASS}>
      {showAuthForm ? (
        <AuthForm
          variant="compact"
          guestAllowed={false}
          showAuthMethodSelector={false}
          onSignupSessionSuccess={() => {
            setHoldSignupContinue(true);
            setPendingCreateRedirect(true);
            setPostAuthPathIntent('/create');
          }}
          onAuthenticated={() => {
            setHoldSignupContinue(false);
            if (pendingCreateRedirect) {
              consumePostAuthPathIntent();
              window.location.assign('/create');
              return;
            }
            clearPostAuthPathIntent();
          }}
        />
      ) : (
        <HostScheduledMissionsPanel />
      )}
    </div>
  );
}
