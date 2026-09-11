import { afterEach, describe, expect, it } from 'vitest';
import {
  listPendingInvitationSaves,
  markPendingInvitationSave,
  takePendingInvitationSave,
} from './pendingInvitationSave';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

afterEach(() => {
  sessionStorage.clear();
});

describe('pendingInvitationSave', () => {
  it('marks and consumes a save intent once', () => {
    markPendingInvitationSave(ID);
    expect(listPendingInvitationSaves()).toEqual([ID]);
    expect(takePendingInvitationSave(ID)).toBe(true);
    expect(takePendingInvitationSave(ID)).toBe(false);
    expect(listPendingInvitationSaves()).toEqual([]);
  });
});
