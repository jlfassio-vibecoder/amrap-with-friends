import { describe, it, expect } from 'vitest';
import { activityLine, recentActivity, shouldShowActivity } from './roomActivity';
import type { RoomMissionLike } from './roomSchedule';

function mission(over: Partial<RoomMissionLike> = {}): RoomMissionLike {
  return {
    missionId: 'm1',
    state: 'finished',
    durationMinutes: 12,
    templateId: 'the-piston',
    scheduledAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: '2026-09-01T12:00:00.000Z',
    finishers: 3,
    ...over,
  };
}

describe('recentActivity', () => {
  it('keeps finished sessions somebody completed', () => {
    expect(recentActivity([mission()])).toHaveLength(1);
  });

  // A page full of abandoned sessions argues against joining.
  it('drops finished sessions nobody completed', () => {
    expect(recentActivity([mission({ finishers: 0 })])).toEqual([]);
  });

  it('drops anything still open', () => {
    expect(recentActivity([mission({ state: 'waiting' })])).toEqual([]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 12 }, (_, i) => mission({ missionId: `m${i}` }));
    expect(recentActivity(many, 5)).toHaveLength(5);
  });

  it('prefers the completion time over the creation time', () => {
    const [row] = recentActivity([
      mission({ createdAt: '2026-09-01T00:00:00.000Z', completedAt: '2026-09-08T00:00:00.000Z' }),
    ]);
    expect(row?.at).toBe('2026-09-08T00:00:00.000Z');
  });

  it('falls back to creation when nothing recorded a completion', () => {
    const [row] = recentActivity([mission({ completedAt: null })]);
    expect(row?.at).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('activityLine', () => {
  it('names the workout when the room used one', () => {
    const [row] = recentActivity([mission({ finishers: 6 })]);
    expect(activityLine(row!, 'The Piston')).toBe('The Piston · 6 athletes finished');
  });

  // "12 min AMRAP" still tells an athlete what they would have been in for.
  it('falls back to the duration when there is no template', () => {
    const [row] = recentActivity([mission({ templateId: null, durationMinutes: 12 })]);
    expect(activityLine(row!)).toBe('12 min AMRAP · 3 athletes finished');
  });

  it('gets the singular right', () => {
    const [row] = recentActivity([mission({ finishers: 1 })]);
    expect(activityLine(row!, 'The Piston')).toBe('The Piston · 1 athlete finished');
  });
});

describe('shouldShowActivity', () => {
  // Every room is empty on its first day; an empty section says the wrong thing.
  it('hides the section rather than showing an empty one', () => {
    expect(shouldShowActivity([])).toBe(false);
    expect(shouldShowActivity(recentActivity([mission()]))).toBe(true);
  });
});
