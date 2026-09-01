import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { HomeIsland } from './HomeIsland';

/**
 * Homepage scheduled-missions slot. Signed-out visitors (and the auth-loading
 * gap) render nothing — the Astro page must not paint an empty white card while
 * `client:only` waits for React.
 */
export default function ScheduledMissions() {
  return (
    <HomeIsland>
      <HomeScheduledMissionsGate />
    </HomeIsland>
  );
}

function HomeScheduledMissionsGate() {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();

  if (isAuthLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="rounded-card border border-night-border bg-surface p-5 text-ink shadow-card">
      <HostScheduledMissionsPanel />
    </div>
  );
}
