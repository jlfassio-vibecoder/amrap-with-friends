import type { TabDefinition } from '@/components/tabs/TopTabs';
import { capabilitiesFor } from '@/lib/rooms/membership';
import type { RoomRole } from '@/lib/rooms/membership';

export type RoomDashboardTabKey = 'missions' | 'schedule' | 'room' | 'comms';

export type RoomDashboardTab = TabDefinition<RoomDashboardTabKey>;

const ALL: readonly RoomDashboardTab[] = [
  { key: 'missions', label: 'Missions' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'room', label: 'Room' },
  { key: 'comms', label: 'Comms' },
];

/**
 * Which sections a seat in this room can see.
 *
 * A pure function rather than conditionals in JSX, because this is the same
 * boundary `capabilitiesFor` already draws and it should be readable in one
 * place. Today owner and co-host see the same four tabs and the differences sit
 * *inside* Room -- a co-host can copy the invite and read the roster but cannot
 * change the brand or appoint another co-host. When a tab becomes wholly
 * owner-only, this is where that goes.
 */
export function roomDashboardTabs(role: RoomRole | null | undefined): readonly RoomDashboardTab[] {
  return capabilitiesFor(role).runRoom ? ALL : [];
}

/**
 * The tab a host lands on.
 *
 * Missions, not Schedule. Opening the dashboard is far more often "what is
 * happening in my room" than "I am about to add another one", and a host who
 * wants to schedule is one tap away either direction.
 */
export const DEFAULT_ROOM_DASHBOARD_TAB: RoomDashboardTabKey = 'missions';

/**
 * Reading a tab from the URL, so a host can link to one and a refresh does not
 * bounce them back to Missions.
 */
export function roomDashboardTabFromParam(
  value: string | null | undefined,
  available: readonly RoomDashboardTab[]
): RoomDashboardTabKey {
  const match = available.find((tab) => tab.key === value);
  return match?.key ?? DEFAULT_ROOM_DASHBOARD_TAB;
}
