import { describe, it, expect } from 'vitest';
import { countRoundsForSegment } from './mySessions';

describe('mySessions helpers', () => {
  it('countRoundsForSegment filters by segment index', () => {
    const rounds = [
      { segment_index: 0 },
      { segment_index: 0 },
      { segment_index: 1 },
    ];

    expect(countRoundsForSegment(rounds, 0)).toBe(2);
    expect(countRoundsForSegment(rounds, 1)).toBe(1);
    expect(countRoundsForSegment(rounds, 2)).toBe(0);
  });
});
