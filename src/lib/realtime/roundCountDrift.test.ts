import { describe, it, expect } from 'vitest';
import { hasRoundCountDrift } from './roundCountDrift';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('hasRoundCountDrift', () => {
  it('is quiet when every count agrees', () => {
    expect(
      hasRoundCountDrift({ [A]: 3, [B]: 5 }, [
        { participantId: A, roundCount: 3 },
        { participantId: B, roundCount: 5 },
      ])
    ).toBe(false);
  });

  // The hole the reconcile was built for: someone else's INSERT never arrived.
  it('reports a round this client never received', () => {
    expect(
      hasRoundCountDrift({ [A]: 3, [B]: 4 }, [
        { participantId: A, roundCount: 3 },
        { participantId: B, roundCount: 5 },
      ])
    ).toBe(true);
  });

  it('reports an athlete this client has never seen', () => {
    expect(
      hasRoundCountDrift({ [A]: 3 }, [
        { participantId: A, roundCount: 3 },
        { participantId: B, roundCount: 1 },
      ])
    ).toBe(true);
  });

  it('treats an unseen athlete with no rounds as agreement, not drift', () => {
    expect(
      hasRoundCountDrift({ [A]: 3 }, [
        { participantId: A, roundCount: 3 },
        { participantId: B, roundCount: 0 },
      ])
    ).toBe(false);
  });

  it('reports holding more rounds than the server has', () => {
    expect(hasRoundCountDrift({ [A]: 4 }, [{ participantId: A, roundCount: 3 }])).toBe(true);
  });

  it('reports a participant the server does not know about', () => {
    expect(hasRoundCountDrift({ [A]: 3, [B]: 2 }, [{ participantId: A, roundCount: 3 }])).toBe(
      true
    );
  });

  it('is quiet on an empty mission', () => {
    expect(hasRoundCountDrift({}, [])).toBe(false);
  });
});
