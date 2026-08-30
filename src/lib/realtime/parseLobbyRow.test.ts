import { describe, expect, it } from 'vitest';
import { parseLobbyRow } from './useLobbyChannel';

/** The payload an authenticated client receives. */
const ROW = {
  id: 'lobby-1',
  host_user_id: 'user-1',
  active_session_id: 'session-1',
  status: 'open',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T11:00:00Z',
};

/** The same payload as an anonymous client sees it: no host_user_id column. */
function withheldFromAnon(): Record<string, unknown> {
  const row: Record<string, unknown> = { ...ROW };
  delete row.host_user_id;
  return row;
}

describe('parseLobbyRow', () => {
  it('reads a full row', () => {
    expect(parseLobbyRow(ROW)).toMatchObject({
      lobbyId: 'lobby-1',
      hostUserId: 'user-1',
      activeSessionId: 'session-1',
      status: 'open',
    });
  });

  it('keeps the row when host_user_id is withheld', () => {
    // A guest is anon, and anon has no SELECT on lobbies.host_user_id. Dropping
    // the row would cost them every active_session_id change, and with it the
    // forced launch into the next mission.
    const parsed = parseLobbyRow(withheldFromAnon());

    expect(parsed).not.toBeNull();
    expect(parsed?.activeSessionId).toBe('session-1');
    expect(parsed?.status).toBe('open');
  });

  it('leaves hostUserId absent rather than null, so a merge keeps the last known host', () => {
    expect(parseLobbyRow(withheldFromAnon())).not.toHaveProperty('hostUserId');
  });

  it('still refuses a row with no id or no usable status', () => {
    expect(parseLobbyRow({ ...ROW, id: undefined })).toBeNull();
    expect(parseLobbyRow({ ...ROW, status: 'wat' })).toBeNull();
  });

  it('treats a missing active session as null rather than dropping the row', () => {
    const parsed = parseLobbyRow({ ...ROW, active_session_id: null });
    expect(parsed?.activeSessionId).toBeNull();
  });

  it('reads next_mission_pending_at when present', () => {
    expect(
      parseLobbyRow({ ...ROW, next_mission_pending_at: '2026-09-01T12:00:00Z' })
    ).toMatchObject({
      nextMissionPendingAt: '2026-09-01T12:00:00Z',
    });
    expect(parseLobbyRow({ ...ROW, next_mission_pending_at: null })).toMatchObject({
      nextMissionPendingAt: null,
    });
    expect(parseLobbyRow(ROW)).not.toHaveProperty('nextMissionPendingAt');
  });
});
