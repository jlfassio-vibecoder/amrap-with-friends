import { describe, expect, it } from 'vitest';
import { shouldSubscribeRallyPointOnMission } from './shouldSubscribeRallyPointOnMission';

describe('shouldSubscribeRallyPointOnMission', () => {
  it('subscribes in waiting and setup for Pass Command roster', () => {
    expect(shouldSubscribeRallyPointOnMission('waiting')).toBe(true);
    expect(shouldSubscribeRallyPointOnMission('setup')).toBe(true);
  });

  it('subscribes in finished for force-nav and daisy', () => {
    expect(shouldSubscribeRallyPointOnMission('finished')).toBe(true);
  });

  it('subscribes during work so Reset rematch can force-nav', () => {
    expect(shouldSubscribeRallyPointOnMission('work')).toBe(true);
  });

  it('rejects unknown phases', () => {
    expect(shouldSubscribeRallyPointOnMission('')).toBe(false);
    expect(shouldSubscribeRallyPointOnMission('paused')).toBe(false);
  });
});
