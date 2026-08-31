import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import {
  getStoredLobbyMemberId,
  getStoredLobbyNickname,
  getStoredLobbySeatClaim,
  persistLobbyIdentity,
} from '@/lib/lobbyIdentity';
import { clearStoredHostToken, persistSessionIdentity } from '@/lib/sessionIdentity';
import { track } from '@/lib/analytics/track';

export type LobbyApiError = { message: string };

export type LobbyMember = {
  id: string;
  userId: string | null;
  nickname: string;
  status: 'active' | 'left';
  lastSeenAt: string;
  joinedAt: string;
};

export type LobbySessionState = 'waiting' | 'setup' | 'work' | 'finished';

export type LobbySnapshot = {
  lobbyId: string;
  /** Null for anonymous get_lobby responses (auth UUIDs redacted). */
  hostUserId: string | null;
  activeSessionId: string | null;
  activeSessionState: LobbySessionState | null;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  /** Host announced Daisy-chain; crew should hang on for the next mission. */
  nextMissionPendingAt: string | null;
  members: LobbyMember[];
};

export type CreateLobbySessionResult = {
  lobbyId: string;
  lobbyMemberId: string;
  sessionId: string;
  hostToken: string;
  participantId: string;
  claimToken: string;
};

export type JoinLobbyResult = {
  lobbyId: string;
  lobbyMemberId: string;
  hostUserId: string;
  status: string;
  activeSessionId: string | null;
  sessionId: string | null;
  sessionState: LobbySessionState | null;
  participantId: string | null;
  nickname: string;
  role: 'host' | 'joiner' | null;
  claimToken: string | null;
  hostToken: string | null;
};

export function isLiveLobbySessionState(
  state: string | null | undefined
): state is 'waiting' | 'setup' | 'work' {
  return state === 'waiting' || state === 'setup' || state === 'work';
}

function parseLobbySessionState(value: unknown): LobbySessionState | null {
  if (value === 'waiting' || value === 'setup' || value === 'work' || value === 'finished') {
    return value;
  }
  return null;
}

const LOBBY_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLobbyIdUuid(value: string): boolean {
  return LOBBY_ID_UUID_RE.test(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Lobby not found')) {
    return 'Staging area not found.';
  }
  if (message.includes('Lobby closed')) {
    return 'This staging area is closed.';
  }
  if (message.includes('Lobby is full') || message.includes('Session is full')) {
    return 'This staging area is full.';
  }
  if (message.includes('Only the host can pass command')) {
    return 'Only the host can pass command.';
  }
  if (message.includes('Only the host can start the next session')) {
    return 'Only the host can start the next session.';
  }
  if (message.includes('Only the host can close')) {
    return 'Only the host can close the staging area.';
  }
  if (message.includes('Target is not an active crew member')) {
    return 'That athlete is not in the staging area.';
  }
  if (message.includes('Cannot pass command to yourself')) {
    return 'Pick someone else to pass command to.';
  }
  if (
    message.includes('Cannot pass command during a live session') ||
    message.includes('Cannot claim command during a live session')
  ) {
    return 'Cannot change host during a live session.';
  }
  if (message.includes('Current session is still active')) {
    return 'Finish the current session before starting the next one.';
  }
  if (message.includes('Host session limit reached')) {
    return 'You already have 3 active sessions.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to continue.';
  }
  if (message.includes('Intake required')) {
    return 'Complete your profile before continuing.';
  }
  if (message.includes('No successor available')) {
    return 'No one else can take command right now.';
  }
  if (message.includes('Not a lobby member')) {
    return 'Join the staging area first.';
  }
  if (message.includes('nickname')) {
    return 'Enter your name or a nickname (max 50 characters).';
  }
  return message;
}

function parseMember(raw: Record<string, unknown>): LobbyMember | null {
  const id = readString(raw.id);
  const nickname = readString(raw.nickname);
  const status = readString(raw.status);
  const lastSeenAt = readString(raw.last_seen_at);
  const joinedAt = readString(raw.joined_at);
  if (!id || !nickname || (status !== 'active' && status !== 'left') || !lastSeenAt || !joinedAt) {
    return null;
  }
  return {
    id,
    userId: readString(raw.user_id),
    nickname,
    status,
    lastSeenAt,
    joinedAt,
  };
}

export async function createLobbySession(input: {
  nickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  scheduledAt?: string | null;
}): Promise<{ data: CreateLobbySessionResult | null; error: LobbyApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await callRpc('create_lobby_session', {
    p_duration_minutes: input.durationMinutes,
    p_nickname: nickname,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
    p_timezone: timeZone,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const lobbyId = readString(raw.lobby_id);
  const lobbyMemberId = readString(raw.lobby_member_id);
  const sessionId = readString(raw.session_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);

  if (!lobbyId || !lobbyMemberId || !sessionId || !hostToken || !participantId || !claimToken) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistLobbyIdentity(lobbyId, { memberId: lobbyMemberId, nickname, sessionId });
  persistSessionIdentity(sessionId, {
    nickname,
    participantId,
    hostToken,
    claimToken,
  });

  track('lobby_created', { session_id: sessionId }, { sessionId, participantId });

  return {
    data: { lobbyId, lobbyMemberId, sessionId, hostToken, participantId, claimToken },
    error: null,
  };
}

export async function joinLobby(input: {
  lobbyId: string;
  nickname: string;
  /** Overrides the stored member id; tests and explicit re-joins use it. */
  lobbyMemberId?: string | null;
}): Promise<{ data: JoinLobbyResult | null; error: LobbyApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }
  const requestLobbyId = input.lobbyId.trim();
  if (!isLobbyIdUuid(requestLobbyId)) {
    return { data: null, error: { message: 'Staging area not found.' } };
  }

  // A guest has no user_id for the server to match on, so hand back the member
  // id + seat_claim we were given the first time. Without the member id every
  // re-join minted a new seat, and start_next_lobby_session makes the force-nav
  // hook re-join on every chained mission. Member ids alone are visible in
  // get_lobby and are not proof of ownership — seat_claim is the secret.
  const knownMemberId =
    input.lobbyMemberId === undefined
      ? getStoredLobbyMemberId(requestLobbyId)
      : input.lobbyMemberId;
  const seatClaim = knownMemberId ? getStoredLobbySeatClaim(requestLobbyId) : null;

  const { data, error } = await callRpc('join_lobby', {
    p_lobby_id: requestLobbyId,
    p_nickname: nickname,
    p_lobby_member_id: knownMemberId,
    p_seat_claim: seatClaim,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const lobbyId = readString(raw.lobby_id);
  const lobbyMemberId = readString(raw.lobby_member_id);
  const hostUserId = readString(raw.host_user_id);
  const status = readString(raw.status) ?? 'open';
  const activeSessionId = readString(raw.active_session_id);
  const sessionId = readString(raw.session_id);
  const participantId = readString(raw.participant_id);
  const roleRaw = readString(raw.role);
  const role = roleRaw === 'host' || roleRaw === 'joiner' ? roleRaw : null;
  const claimToken = readString(raw.claim_token);
  const hostToken = readString(raw.host_token);
  const seatClaimOut = readString(raw.seat_claim);
  const sessionState = parseLobbySessionState(raw.session_state);

  if (!lobbyId || !lobbyMemberId || !hostUserId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistLobbyIdentity(lobbyId, {
    memberId: lobbyMemberId,
    nickname: readString(raw.nickname) ?? nickname,
    sessionId,
    seatClaim: seatClaimOut,
  });

  if (sessionId && participantId) {
    persistSessionIdentity(sessionId, {
      nickname: readString(raw.nickname) ?? nickname,
      participantId,
      ...(hostToken ? { hostToken } : {}),
      ...(claimToken ? { claimToken } : {}),
    });
  }

  track('lobby_joined', { has_session: Boolean(sessionId), role }, { sessionId, participantId });

  return {
    data: {
      lobbyId,
      lobbyMemberId,
      hostUserId,
      status,
      activeSessionId,
      sessionId,
      sessionState,
      participantId,
      nickname: readString(raw.nickname) ?? nickname,
      role,
      claimToken,
      hostToken,
    },
    error: null,
  };
}

export async function getLobby(
  lobbyId: string
): Promise<{ data: LobbySnapshot | null; error: LobbyApiError | null }> {
  const { data, error } = await callRpc('get_lobby', { p_lobby_id: lobbyId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const id = readString(raw.lobby_id);
  const hostUserId = readString(raw.host_user_id);
  const status = readString(raw.status);
  const createdAt = readString(raw.created_at);
  const updatedAt = readString(raw.updated_at);
  if (!id || (status !== 'open' && status !== 'closed') || !createdAt || !updatedAt) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const membersRaw = Array.isArray(raw.members) ? raw.members : [];
  const members = membersRaw
    .map((entry) =>
      entry && typeof entry === 'object' ? parseMember(entry as Record<string, unknown>) : null
    )
    .filter((m): m is LobbyMember => m !== null);

  return {
    data: {
      lobbyId: id,
      hostUserId,
      activeSessionId: readString(raw.active_session_id),
      activeSessionState: parseLobbySessionState(raw.active_session_state),
      status,
      createdAt,
      updatedAt,
      nextMissionPendingAt: readString(raw.next_mission_pending_at),
      members,
    },
    error: null,
  };
}

export async function announceNextMission(
  lobbyId: string
): Promise<{
  data: { ok: boolean; nextMissionPendingAt: string | null } | null;
  error: LobbyApiError | null;
}> {
  const { data, error } = await callRpc('announce_next_mission', { p_lobby_id: lobbyId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  return {
    data: {
      ok: true,
      nextMissionPendingAt: readString(raw.next_mission_pending_at),
    },
    error: null,
  };
}

export async function passLobbyCommand(input: { lobbyId: string; toUserId: string }): Promise<{
  data: { hostUserId: string; hostToken: string | null; activeSessionId: string | null } | null;
  error: LobbyApiError | null;
}> {
  const { data, error } = await callRpc('pass_lobby_command', {
    p_lobby_id: input.lobbyId,
    p_to_user_id: input.toUserId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const hostUserId = readString(raw.host_user_id);
  if (!hostUserId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  const activeSessionId = readString(raw.active_session_id);
  // Rotated token is never returned to the outgoing host; clear any stale local copy.
  if (activeSessionId) {
    clearStoredHostToken(activeSessionId);
  }
  track('command_passed', { to_user_id: input.toUserId });
  return {
    data: {
      hostUserId,
      hostToken: readString(raw.host_token),
      activeSessionId,
    },
    error: null,
  };
}

export async function startNextLobbySession(input: {
  lobbyId: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
}): Promise<{
  data: { sessionId: string; hostToken: string; participantId: string } | null;
  error: LobbyApiError | null;
}> {
  const { data, error } = await callRpc('start_next_lobby_session', {
    p_lobby_id: input.lobbyId,
    p_duration_minutes: input.durationMinutes,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const sessionId = readString(raw.session_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  if (!sessionId || !hostToken || !participantId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const nickname = getStoredLobbyNickname(input.lobbyId) ?? 'Athlete';
  const memberId = getStoredLobbyMemberId(input.lobbyId);
  persistSessionIdentity(sessionId, {
    nickname,
    participantId,
    hostToken,
  });
  if (memberId) {
    persistLobbyIdentity(input.lobbyId, {
      memberId,
      nickname,
      sessionId,
    });
  }

  track('lobby_next_session', {}, { sessionId, participantId });

  return { data: { sessionId, hostToken, participantId }, error: null };
}

export async function leaveLobby(
  lobbyId: string,
  options?: { lobbyMemberId?: string | null }
): Promise<{ data: { left: boolean; closed?: boolean } | null; error: LobbyApiError | null }> {
  // As with joinLobby: a guest leaves with the member id + seat_claim it was
  // handed. Member id alone is not proof — it is visible in get_lobby.
  const lobbyMemberId =
    options?.lobbyMemberId === undefined ? getStoredLobbyMemberId(lobbyId) : options.lobbyMemberId;
  const seatClaim = lobbyMemberId ? getStoredLobbySeatClaim(lobbyId) : null;

  const { data, error } = await callRpc('leave_lobby', {
    p_lobby_id: lobbyId,
    p_lobby_member_id: lobbyMemberId,
    p_seat_claim: seatClaim,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const closed = raw.closed === true;
  const wasHost = raw.was_host === true;
  if (closed) {
    track('lobby_closed', {});
  } else if (wasHost) {
    track('lobby_host_reassigned', {});
  }
  return {
    data: { left: raw.left === true, closed },
    error: null,
  };
}

export async function closeLobby(
  lobbyId: string
): Promise<{ data: { ok: boolean } | null; error: LobbyApiError | null }> {
  const { error } = await callRpc('close_lobby', { p_lobby_id: lobbyId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  track('lobby_closed', {});
  return { data: { ok: true }, error: null };
}

export async function touchLobbyPresence(
  lobbyId: string
): Promise<{ data: { ok: boolean } | null; error: LobbyApiError | null }> {
  const { data, error } = await callRpc('touch_lobby_presence', { p_lobby_id: lobbyId });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { data: { ok: raw.ok === true }, error: null };
}

export async function claimLobbyCommandIfStale(lobbyId: string): Promise<{
  data: {
    claimed: boolean;
    hostUserId: string | null;
    hostToken: string | null;
    activeSessionId: string | null;
    reason: string | null;
  } | null;
  error: LobbyApiError | null;
}> {
  const { data, error } = await callRpc('claim_lobby_command_if_stale', {
    p_lobby_id: lobbyId,
  });
  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.claimed === true) {
    track('lobby_host_reassigned', {});
  }
  return {
    data: {
      claimed: raw.claimed === true,
      hostUserId: readString(raw.host_user_id),
      hostToken: readString(raw.host_token),
      activeSessionId: readString(raw.active_session_id),
      reason: readString(raw.reason),
    },
    error: null,
  };
}
