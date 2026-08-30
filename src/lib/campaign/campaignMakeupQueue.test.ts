import { describe, expect, it } from 'vitest';
import {
  campaignMakeupQueue,
  campaignMakeupQueueHead,
  type MakeupQueueInput,
  type MakeupQueueOccurrence,
} from './campaignMakeupQueue';

function occurrence(
  sequence: number,
  overrides: Partial<MakeupQueueOccurrence> = {}
): MakeupQueueOccurrence {
  return {
    occurrenceId: `o${sequence}`,
    sequence,
    localDate: `2026-10-${String(sequence).padStart(2, '0')}`,
    status: 'done',
    ...overrides,
  };
}

function input(overrides: Partial<MakeupQueueInput> = {}): MakeupQueueInput {
  return {
    occurrences: [
      occurrence(1),
      occurrence(2),
      occurrence(3, { status: 'planned' }),
      occurrence(4, { status: 'skipped' }),
    ],
    viewerJoinedLocalDate: '2026-10-01',
    viewerUserId: 'u1',
    scores: [],
    makeups: [],
    ...overrides,
  };
}

describe('campaignMakeupQueue', () => {
  it('lists done and skipped occurrences oldest-first', () => {
    const owed = campaignMakeupQueue(input());
    expect(owed.map((row) => row.occurrenceId)).toEqual(['o1', 'o2', 'o4']);
    expect(campaignMakeupQueueHead(input())?.occurrenceId).toBe('o1');
  });

  it('ignores planned and generated occurrences', () => {
    const owed = campaignMakeupQueue(
      input({
        occurrences: [
          occurrence(1, { status: 'planned' }),
          occurrence(2, { status: 'generated' }),
          occurrence(3, { status: 'done' }),
        ],
      })
    );
    expect(owed.map((row) => row.occurrenceId)).toEqual(['o3']);
  });

  it('skips occurrences before the athlete joined', () => {
    const owed = campaignMakeupQueue(
      input({
        viewerJoinedLocalDate: '2026-10-02',
        occurrences: [occurrence(1), occurrence(2), occurrence(3, { status: 'done' })],
      })
    );
    expect(owed.map((row) => row.occurrenceId)).toEqual(['o2', 'o3']);
  });

  it('clears debt when the athlete has a scored result', () => {
    const owed = campaignMakeupQueue(
      input({
        scores: [
          { occurrenceId: 'o1', userId: 'u1', finalScore: 42 },
          { occurrenceId: 'o2', userId: 'u2', finalScore: 99 },
        ],
      })
    );
    expect(owed.map((row) => row.occurrenceId)).toEqual(['o2', 'o4']);
  });

  it('clears debt when a makeup row already exists', () => {
    const owed = campaignMakeupQueue(
      input({
        makeups: [{ occurrenceId: 'o1' }],
      })
    );
    expect(owed.map((row) => row.occurrenceId)).toEqual(['o2', 'o4']);
  });

  it('returns an empty queue when caught up', () => {
    expect(
      campaignMakeupQueue(
        input({
          scores: [
            { occurrenceId: 'o1', userId: 'u1', finalScore: 10 },
            { occurrenceId: 'o2', userId: 'u1', finalScore: 10 },
            { occurrenceId: 'o4', userId: 'u1', finalScore: 10 },
          ],
        })
      )
    ).toEqual([]);
    expect(
      campaignMakeupQueueHead(
        input({ makeups: [{ occurrenceId: 'o1' }, { occurrenceId: 'o2' }, { occurrenceId: 'o4' }] })
      )
    ).toBeNull();
  });
});
