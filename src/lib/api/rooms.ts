import { callRpc } from '@/lib/api/callRpc';
import { persistMissionIdentity } from '@/lib/missionIdentity';
import { parseRoomBrand, type RoomBrand } from '@/lib/rooms/brand';
import type { RoomFeedRow } from '@/lib/rooms/roomFeed';
import { isRoomReaction, type RoomReaction } from '@/lib/rooms/reactions';
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
  announcement: string | null;
  brand: RoomBrand | null;
  /** The viewer's own setting. Null when signed out or not a member. */
  myActivityVisible: boolean | null;
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
      announcement: str(room.announcement),
      brand: parseRoomBrand(room.brand),
      myActivityVisible:
        typeof room.my_activity_visible === 'boolean' ? room.my_activity_visible : null,
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

export interface MissionRoom {
  id: string;
  handle: string;
  displayName: string;
  isMember: boolean;
  hasHomeCoach: boolean;
  brand: RoomBrand | null;
}

/**
 * The room a mission belongs to, or null for a personal mission.
 *
 * Deliberately its own call rather than a field on the live-state snapshot:
 * the post-finish sheet needs it once, and that snapshot is pulled on a timer
 * by every client in the room.
 */
export async function getMissionRoom(missionId: string): Promise<MissionRoom | null> {
  const { data, error } = await callRpc<unknown>('get_mission_room', {
    p_mission_id: missionId,
  });
  if (error) {
    return null;
  }
  const payload = record(data);
  const room = payload ? record(payload.room) : null;
  const id = room ? str(room.id) : null;
  const handle = room ? str(room.handle) : null;
  if (!room || !id || !handle) {
    return null;
  }
  return {
    id,
    handle,
    displayName: str(room.display_name) ?? handle,
    isMember: room.is_member === true,
    hasHomeCoach: room.has_home_coach === true,
    brand: parseRoomBrand(room.brand),
  };
}

export interface RoomMember {
  userId: string;
  role: RoomRole;
  nickname: string | null;
  joinedAt: string;
}

export async function listRoomMembers(
  roomId: string
): Promise<{ ok: true; members: RoomMember[] } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('list_room_members', { p_room_id: roomId });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true || !Array.isArray(payload.members)) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }

  const members: RoomMember[] = [];
  for (const entry of payload.members) {
    const row = record(entry);
    const userId = row ? str(row.user_id) : null;
    const seat = row ? role(row.role) : null;
    if (!row || !userId || !seat) {
      continue;
    }
    members.push({
      userId,
      role: seat,
      nickname: str(row.nickname),
      joinedAt: str(row.joined_at) ?? '',
    });
  }
  return { ok: true, members };
}

export interface RoomActivity {
  finishedThisWeek: number;
  athletesThisWeek: number;
  missionsThisWeek: number;
  returningAthletes: number;
}

export async function getRoomActivity(
  roomId: string
): Promise<{ ok: true; activity: RoomActivity } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('room_activity_summary', { p_room_id: roomId });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }
  const num = (value: unknown): number => (typeof value === 'number' ? value : 0);
  return {
    ok: true,
    activity: {
      finishedThisWeek: num(payload.finished_this_week),
      athletesThisWeek: num(payload.athletes_this_week),
      missionsThisWeek: num(payload.missions_this_week),
      returningAthletes: num(payload.returning_athletes),
    },
  };
}

export async function setRoomCohost(
  roomId: string,
  userId: string,
  isCohost: boolean
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await callRpc<unknown>('set_room_cohost', {
    p_room_id: roomId,
    p_user_id: userId,
    p_is_cohost: isCohost,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  return payload?.ok === true
    ? { ok: true }
    : { ok: false, reason: str(payload?.reason) ?? 'unknown' };
}

export interface RoomMission {
  missionId: string;
  state: string;
  durationMinutes: number;
  templateId: string | null;
  scheduledAt: string | null;
  createdAt: string;
  /** When someone actually finished it, which is not when it was scheduled. */
  completedAt: string | null;
  finishers: number;
}

function parseMissions(value: unknown): RoomMission[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const missions: RoomMission[] = [];
  for (const entry of value) {
    const row = record(entry);
    const missionId = row ? str(row.mission_id) : null;
    if (!row || !missionId) {
      continue;
    }
    missions.push({
      missionId,
      state: str(row.state) ?? 'waiting',
      durationMinutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : 0,
      templateId: str(row.template_id),
      scheduledAt: str(row.scheduled_at),
      createdAt: str(row.created_at) ?? '',
      completedAt: str(row.completed_at),
      finishers: typeof row.finishers === 'number' ? row.finishers : 0,
    });
  }
  return missions;
}

/**
 * Upcoming and recent come back as separate lists, ordered by the server.
 * One capped list could not answer both questions: an older scheduled mission
 * can be the earliest upcoming one, and the only completed mission can sit
 * behind a page of newer scheduled rows.
 */
export async function listRoomMissions(
  roomId: string
): Promise<
  { ok: true; upcoming: RoomMission[]; recent: RoomMission[] } | { ok: false; reason: string }
> {
  const { data, error } = await callRpc<unknown>('list_room_missions', { p_room_id: roomId });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }
  return {
    ok: true,
    upcoming: parseMissions(payload.upcoming),
    recent: parseMissions(payload.recent),
  };
}

export interface ScheduleRoomMissionInput {
  roomId: string;
  nickname: string;
  durationMinutes: number;
  workout: unknown;
  templateId?: string | null;
  intensityTier?: number | null;
  /** ISO instant, or null to open one now. */
  scheduledAt?: string | null;
}

export async function scheduleRoomMission(
  input: ScheduleRoomMissionInput
): Promise<{ ok: true; missionId: string } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('schedule_room_mission', {
    p_room_id: input.roomId,
    p_nickname: input.nickname,
    p_duration_minutes: input.durationMinutes,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  const missionId = payload ? str(payload.mission_id) : null;
  if (!payload || payload.ok !== true || !missionId) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }

  // Keep the host identity the RPC just minted. Without it the coach has a
  // mission they own and no way to start it -- the tokens are returned once
  // and never again.
  const hostToken = str(payload.host_token);
  const participantId = str(payload.participant_id);
  const claimToken = str(payload.claim_token);
  if (hostToken && participantId) {
    persistMissionIdentity(missionId, {
      nickname: input.nickname,
      participantId,
      hostToken,
      ...(claimToken ? { claimToken } : {}),
    });
  }

  return { ok: true, missionId };
}

/** Pass an empty body to take the announcement down. */
export async function setRoomAnnouncement(
  roomId: string,
  body: string
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await callRpc<unknown>('set_room_announcement', {
    p_room_id: roomId,
    p_body: body,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  return payload?.ok === true
    ? { ok: true }
    : { ok: false, reason: str(payload?.reason) ?? 'unknown' };
}

/**
 * Owner-only, and the RPC says so again -- a co-host runs missions, but the
 * room's identity is not theirs to change. Pass an empty accent to clear it.
 */
export async function setRoomBrand(
  roomId: string,
  accent: string
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await callRpc<unknown>('set_room_brand', {
    p_room_id: roomId,
    p_accent: accent,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  return payload?.ok === true
    ? { ok: true }
    : { ok: false, reason: str(payload?.reason) ?? 'unknown' };
}

/**
 * The public activity feed. Readable signed out, because a room address exists
 * to be posted anywhere.
 *
 * The nickname arrives already resolved: null for a guest and for a member who
 * opted out, identically. Nothing here may try to tell those apart.
 */
export async function listRoomActivity(
  roomId: string,
  limit = 20
): Promise<{ ok: true; rows: RoomFeedRow[] } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('list_room_activity', {
    p_room_id: roomId,
    p_limit: limit,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true || !Array.isArray(payload.activity)) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }

  const rows: RoomFeedRow[] = [];
  for (const entry of payload.activity) {
    const item = record(entry);
    const participantId = item ? str(item.participant_id) : null;
    const missionId = item ? str(item.mission_id) : null;
    const finishedAt = item ? str(item.finished_at) : null;
    if (!item || !participantId || !missionId || !finishedAt) {
      continue;
    }
    const score = Number(item.base_score);
    rows.push({
      participantId,
      missionId,
      templateId: str(item.template_id),
      nickname: str(item.nickname),
      score: Number.isFinite(score) ? score : null,
      unit: item.score_unit === 'rounds' ? 'rounds' : 'reps',
      finishedAt,
      reactionCount: typeof item.reaction_count === 'number' ? item.reaction_count : 0,
    });
  }
  return { ok: true, rows };
}

/** A member's own switch: whether their name shows in this room's activity. */
export async function setRoomActivityVisible(
  roomId: string,
  visible: boolean
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await callRpc<unknown>('set_room_activity_visible', {
    p_room_id: roomId,
    p_visible: visible,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  return payload?.ok === true
    ? { ok: true }
    : { ok: false, reason: str(payload?.reason) ?? 'unknown' };
}

export interface RoomFinish {
  participantId: string;
  segmentIndex: number;
  nickname: string;
  missionId: string;
  templateId: string | null;
  /** Reps or rounds actually done. Never the P.V.I.-adjusted final score. */
  baseScore: number | null;
  scoreUnit: 'reps' | 'rounds';
  finishedAt: string;
  isGuest: boolean;
  myReaction: RoomReaction | null;
  reactionCount: number;
}

export async function listRoomFinishes(
  roomId: string
): Promise<{ ok: true; finishes: RoomFinish[] } | { ok: false; reason: string }> {
  const { data, error } = await callRpc<unknown>('list_room_finishes', { p_room_id: roomId });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  if (!payload || payload.ok !== true || !Array.isArray(payload.finishes)) {
    return { ok: false, reason: str(payload?.reason) ?? 'invalid_response' };
  }

  const finishes: RoomFinish[] = [];
  for (const entry of payload.finishes) {
    const row = record(entry);
    const participantId = row ? str(row.participant_id) : null;
    const missionId = row ? str(row.mission_id) : null;
    if (!row || !participantId || !missionId) {
      continue;
    }
    const reaction = str(row.my_reaction);
    finishes.push({
      participantId,
      segmentIndex: typeof row.segment_index === 'number' ? row.segment_index : 0,
      nickname: str(row.nickname) ?? '',
      missionId,
      templateId: str(row.template_id),
      baseScore: typeof row.base_score === 'number' ? row.base_score : null,
      scoreUnit: row.score_unit === 'rounds' ? 'rounds' : 'reps',
      finishedAt: str(row.finished_at) ?? '',
      isGuest: row.is_guest === true,
      myReaction: reaction && isRoomReaction(reaction) ? reaction : null,
      reactionCount: typeof row.reaction_count === 'number' ? row.reaction_count : 0,
    });
  }
  return { ok: true, finishes };
}

export async function reactToFinish(
  participantId: string,
  segmentIndex: number,
  reaction: RoomReaction | null
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await callRpc<unknown>('react_to_finish', {
    p_participant_id: participantId,
    p_segment_index: segmentIndex,
    p_reaction: reaction,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = record(data);
  return payload?.ok === true
    ? { ok: true }
    : { ok: false, reason: str(payload?.reason) ?? 'unknown' };
}
