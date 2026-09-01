import { AuthForm } from '@/components/AuthForm';
import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
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

  if (isAuthLoading) {
    return null;
  }

  return (
    <div className={CARD_CLASS}>
      {isAuthenticated ? (
        <HostScheduledMissionsPanel />
      ) : (
        <AuthForm variant="compact" guestAllowed={false} showAuthMethodSelector={false} />
      )}
    </div>
  );
}
