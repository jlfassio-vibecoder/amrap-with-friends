import { callRpc } from '@/lib/api/callRpc';
import type { RoomRole } from '@/lib/rooms/membership';

/**
 * The room RPCs. Every table behind these is revoked from anon and
 * authenticated, so there is no direct-query fallback to reach for.
 */

export interface RoomSummary {
  roomId: string;
  handle: string;
  displayName: string;
  role: RoomRole;
  isActive: boolean;
  memberCount: number;
}

export interface RoomPage {
  id: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  intro: string | null;
  timezone: string;
  isActive: boolean;
  memberCount: number;
  myRole: RoomRole | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function role(value: unknown): RoomRole | null {
  return value === 'owner' || value === 'cohost' || value === 'member' ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export type GetRoomResult =
  | { ok: true; room: RoomPage }
  /** The handle moved; `handle` is where it went. */
  | { ok: false; reason: 'moved'; handle: string }
  | { ok: false; reason: string };

export async function getRoomByHandle(handle: string): Promise<GetRoomResult> {
  const { data, error } = await callRpc<unknown>('get_room_by_handle', {
    p_handle: handle.trim().toLowerCase(),
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload) {
    return { ok: false, reason: 'invalid_response' };
  }
  if (payload.ok !== true) {
    const reason = str(payload.reason) ?? 'unknown';
    const moved = str(payload.handle);
    return reason === 'moved' && moved
      ? { ok: false, reason: 'moved', handle: moved }
      : { ok: false, reason };
  }

  const room = record(payload.room);
  const id = room ? str(room.id) : null;
  const roomHandle = room ? str(room.handle) : null;
  if (!room || !id || !roomHandle) {
    return { ok: false, reason: 'invalid_response' };
  }

  return {
    ok: true,
    room: {
      id,
      handle: roomHandle,
      displayName: str(room.display_name) ?? roomHandle,
      avatarPath: str(room.avatar_path),
      intro: str(room.intro),
      timezone: str(room.timezone) ?? 'UTC',
      isActive: room.is_active === true,
      memberCount: typeof room.member_count === 'number' ? room.member_count : 0,
      myRole: role(room.my_role),
    },
  };
}

export async function listMyRooms(): Promise<
  { ok: true; rooms: RoomSummary[] } | { ok: false; reason: string }
> {
  const { data, error } = await callRpc<unknown>('list_my_rooms', {});
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true || !Array.isArray(payload.rooms)) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }

  const rooms: RoomSummary[] = [];
  for (const entry of payload.rooms) {
    const row = record(entry);
    const roomId = row ? str(row.room_id) : null;
    const handle = row ? str(row.handle) : null;
    const seat = row ? role(row.role) : null;
    if (!row || !roomId || !handle || !seat) {
      continue;
    }
    rooms.push({
      roomId,
      handle,
      displayName: str(row.display_name) ?? handle,
      role: seat,
      isActive: row.is_active === true,
      memberCount: typeof row.member_count === 'number' ? row.member_count : 0,
    });
  }
  return { ok: true, rooms };
}

export async function createRoom(input: {
  handle: string;
  displayName: string;
  kind?: 'coach' | 'gym';
  timezone?: string;
}): Promise<{ ok: true; roomId: string; handle: string } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('create_room', {
    p_handle: input.handle.trim().toLowerCase(),
    p_display_name: input.displayName.trim(),
    p_kind: input.kind ?? 'coach',
    p_timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  const roomId = payload ? str(payload.room_id) : null;
  const handle = payload ? str(payload.handle) : null;
  if (!payload || payload.ok !== true || !roomId || !handle) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }
  return { ok: true, roomId, handle };
}

export interface JoinRoomOutcome {
  ok: true;
  roomId: string;
  /** True when this join created the attribution. */
  homeCoachSet: boolean;
  /** True when the athlete already had a home coach, who is unchanged. */
  homeCoachAlreadySet: boolean;
}

export async function joinRoom(
  roomId: string,
  setHomeCoach: boolean
): Promise<JoinRoomOutcome | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('join_room', {
    p_room_id: roomId,
    p_set_home_coach: setHomeCoach,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }
  return {
    ok: true,
    roomId,
    homeCoachSet: payload.home_coach_set === true,
    homeCoachAlreadySet: payload.home_coach_already_set === true,
  };
}
