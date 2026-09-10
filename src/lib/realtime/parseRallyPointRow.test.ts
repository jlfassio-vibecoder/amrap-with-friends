import { describe, expect, it } from 'vitest';
import { parseRallyPointRow } from './useRallyPointChannel';

/** The payload an authenticated client receives. */
const ROW = {
  id: 'rallyPoint-1',
  host_user_id: 'user-1',
  active_mission_id: 'mission-1',
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

describe('parseRallyPointRow', () => {
  it('reads a full row', () => {
    expect(parseRallyPointRow(ROW)).toMatchObject({
      rallyPointId: 'rallyPoint-1',
      hostUserId: 'user-1',
      activeMissionId: 'mission-1',
      status: 'open',
    });
  });

  it('keeps the row when host_user_id is withheld', () => {
    // A guest is anon, and anon has no SELECT on rallyPoints.host_user_id. Dropping
    // the row would cost them every active_mission_id change, and with it the
    // forced launch into the next mission.
    const parsed = parseRallyPointRow(withheldFromAnon());

    expect(parsed).not.toBeNull();
    expect(parsed?.activeMissionId).toBe('mission-1');
    expect(parsed?.status).toBe('open');
  });

  it('leaves hostUserId absent rather than null, so a merge keeps the last known host', () => {
    expect(parseRallyPointRow(withheldFromAnon())).not.toHaveProperty('hostUserId');
  });

  it('still refuses a row with no id or no usable status', () => {
    expect(parseRallyPointRow({ ...ROW, id: undefined })).toBeNull();
    expect(parseRallyPointRow({ ...ROW, status: 'wat' })).toBeNull();
  });

  it('treats a missing active mission as null rather than dropping the row', () => {
    const parsed = parseRallyPointRow({ ...ROW, active_mission_id: null });
    expect(parsed?.activeMissionId).toBeNull();
  });

  it('reads next_mission_pending_at when present', () => {
    expect(
      parseRallyPointRow({ ...ROW, next_mission_pending_at: '2026-09-01T12:00:00Z' })
    ).toMatchObject({
      nextMissionPendingAt: '2026-09-01T12:00:00Z',
    });
    expect(parseRallyPointRow({ ...ROW, next_mission_pending_at: null })).toMatchObject({
      nextMissionPendingAt: null,
    });
    expect(parseRallyPointRow(ROW)).not.toHaveProperty('nextMissionPendingAt');
  });
});
