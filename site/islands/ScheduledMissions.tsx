import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';
import { HomeIsland } from './HomeIsland';

/** Signed-in only; renders nothing for a visitor, which is why it can hydrate late. */
export default function ScheduledMissions() {
  return (
    <HomeIsland>
      <HostScheduledMissionsPanel />
    </HomeIsland>
  );
}
