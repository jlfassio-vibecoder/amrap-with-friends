import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_DASHBOARD_TAB,
  roomDashboardTabFromParam,
  roomDashboardTabs,
} from '@/lib/rooms/roomDashboardTabs';

describe('roomDashboardTabs', () => {
  it('gives a host all four sections', () => {
    expect(roomDashboardTabs('owner').map((tab) => tab.key)).toEqual([
      'missions',
      'schedule',
      'room',
      'comms',
    ]);
  });

  it('gives a co-host the same four — the differences are inside Room', () => {
    expect(roomDashboardTabs('cohost')).toEqual(roomDashboardTabs('owner'));
  });

  it('gives a plain member nothing, because this is not their page', () => {
    expect(roomDashboardTabs('member')).toEqual([]);
    expect(roomDashboardTabs(null)).toEqual([]);
  });
});

describe('roomDashboardTabFromParam', () => {
  const tabs = roomDashboardTabs('owner');

  it('opens on Missions, not on the scheduling form', () => {
    expect(DEFAULT_ROOM_DASHBOARD_TAB).toBe('missions');
    expect(roomDashboardTabFromParam(null, tabs)).toBe('missions');
  });

  it('honours a linked tab', () => {
    expect(roomDashboardTabFromParam('comms', tabs)).toBe('comms');
  });

  it('falls back rather than showing a blank page for a stale link', () => {
    expect(roomDashboardTabFromParam('billing', tabs)).toBe('missions');
  });

  it('never returns a tab this seat cannot see', () => {
    expect(roomDashboardTabFromParam('room', roomDashboardTabs('member'))).toBe('missions');
  });
});
