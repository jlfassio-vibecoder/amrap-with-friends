import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  clearPendingRoomSave,
  markPendingRoomSave,
  takePendingRoomSave,
} from './pendingRoomSave';

describe('pendingRoomSave', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('carries the intent for the mission it was set on', () => {
    markPendingRoomSave('mission-1');
    expect(takePendingRoomSave('mission-1')).toBe(true);
  });

  it('does not leak between missions', () => {
    markPendingRoomSave('mission-1');
    expect(takePendingRoomSave('mission-2')).toBe(false);
    expect(takePendingRoomSave('mission-1')).toBe(true);
  });

  // A remount, a re-render and the modal callback can all arrive for one
  // intent; consuming on read means only the first of them acts.
  it('is consumed by the first read', () => {
    markPendingRoomSave('mission-1');
    expect(takePendingRoomSave('mission-1')).toBe(true);
    expect(takePendingRoomSave('mission-1')).toBe(false);
  });

  it('is false when nothing was ever marked', () => {
    expect(takePendingRoomSave('mission-1')).toBe(false);
  });

  it('can be abandoned when the athlete closes sign-up', () => {
    markPendingRoomSave('mission-1');
    clearPendingRoomSave('mission-1');
    expect(takePendingRoomSave('mission-1')).toBe(false);
  });

  describe('when storage throws, as it does in private mode', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not take the page down', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('denied');
      });

      expect(() => markPendingRoomSave('mission-1')).not.toThrow();
      expect(() => clearPendingRoomSave('mission-1')).not.toThrow();
      expect(takePendingRoomSave('mission-1')).toBe(false);
    });
  });
});
