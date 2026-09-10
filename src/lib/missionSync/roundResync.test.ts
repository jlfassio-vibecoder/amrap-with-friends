import { describe, expect, it } from 'vitest';
import { shouldResyncAfterLog } from '@/lib/missionSync/roundResync';

describe('shouldResyncAfterLog', () => {
  it('does nothing when the server wrote the index we asked for', () => {
    expect(shouldResyncAfterLog(5, 5)).toBe(false);
  });

  it('resyncs when the server healed a stale index', () => {
    // Observed on a live mission: the client held 5 rounds, the database held
    // 6. Without this the count on screen stays wrong for the rest of it.
    expect(shouldResyncAfterLog(5, 6)).toBe(true);
  });

  it('resyncs however far behind the client had fallen', () => {
    expect(shouldResyncAfterLog(2, 9)).toBe(true);
  });
});
