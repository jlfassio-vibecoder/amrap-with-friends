import { callRpc } from '@/lib/api/callRpc';

export type SquadApiError = { message: string };

export type SquadSearchStatus = 'none' | 'pending_out' | 'pending_in' | 'friends';

export interface SquadAthlete {
  userId: string;
  username: string | null;
  nickname: string | null;
}

export interface SquadRequestEntry extends SquadAthlete {
  requestId: string;
}

export interface SquadSearchHit extends SquadAthlete {
  status: SquadSearchStatus;
  /** Present for pending_in / pending_out, so a search result can be acted on. */
  requestId: string | null;
}

export interface MySquad {
  inviteCode: string;
  friends: SquadAthlete[];
  incoming: SquadRequestEntry[];
  outgoing: SquadRequestEntry[];
  friendLimit: number;
}

export interface SquadInvitePreview {
  username: string | null;
  nickname: string | null;
}

const ERROR_COPY: Record<string, string> = {
  'Authentication required': 'Sign in to manage your squad.',
  'Intake required': 'Complete your profile before inviting people to your squad.',
  'Already friends': "You are already on each other's squad.",
  'Squad full': 'That squad is full.',
  'Invite declined recently':
    'They declined recently. Give it a few days before asking again.',
  'Invite blocked': 'They have declined your invites, so you cannot send another.',
  'Invite not found': 'That invite is not available.',
  'Friend not found': 'That person is not on your squad.',
};

function mapError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  for (const [needle, copy] of Object.entries(ERROR_COPY)) {
    if (message.includes(needle)) {
      return copy;
    }
  }
  return message;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function parseAthlete(raw: unknown): SquadAthlete | null {
  const row = readRecord(raw);
  const userId = readString(row.user_id);
  if (!userId) {
    return null;
  }
  return {
    userId,
    username: readString(row.username),
    nickname: readString(row.nickname),
  };
}

function parseRequest(raw: unknown): SquadRequestEntry | null {
  const athlete = parseAthlete(raw);
  const requestId = readString(readRecord(raw).request_id);
  if (!athlete || !requestId) {
    return null;
  }
  return { ...athlete, requestId };
}

function parseSearchHit(raw: unknown): SquadSearchHit | null {
  const athlete = parseAthlete(raw);
  const status = readString(readRecord(raw).status);
  if (!athlete || !status) {
    return null;
  }
  if (
    status !== 'none' &&
    status !== 'pending_out' &&
    status !== 'pending_in' &&
    status !== 'friends'
  ) {
    return null;
  }
  return { ...athlete, status, requestId: readString(readRecord(raw).request_id) };
}

export async function fetchMySquad(): Promise<{
  data: MySquad | null;
  error: SquadApiError | null;
}> {
  const { data, error } = await callRpc('my_squad');
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const root = readRecord(data);
  const inviteCode = readString(root.invite_code);
  if (!inviteCode) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const friends = Array.isArray(root.friends) ? root.friends : [];
  const incoming = Array.isArray(root.incoming) ? root.incoming : [];
  const outgoing = Array.isArray(root.outgoing) ? root.outgoing : [];

  return {
    data: {
      inviteCode,
      friends: friends.map(parseAthlete).filter((entry): entry is SquadAthlete => entry !== null),
      incoming: incoming
        .map(parseRequest)
        .filter((entry): entry is SquadRequestEntry => entry !== null),
      outgoing: outgoing
        .map(parseRequest)
        .filter((entry): entry is SquadRequestEntry => entry !== null),
      friendLimit: readNumber(root.friend_limit) || 50,
    },
    error: null,
  };
}

export async function searchAthletes(
  query: string
): Promise<{ data: SquadSearchHit[]; error: SquadApiError | null }> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { data: [], error: null };
  }

  const { data, error } = await callRpc('search_athletes', { p_query: trimmed });
  if (error) {
    return { data: [], error: { message: mapError(error.message) } };
  }

  const rows = readRecord(data).athletes;
  if (!Array.isArray(rows)) {
    return { data: [], error: null };
  }

  return {
    data: rows.map(parseSearchHit).filter((entry): entry is SquadSearchHit => entry !== null),
    error: null,
  };
}

export async function sendSquadInvite(userId: string): Promise<{ error: SquadApiError | null }> {
  const { error } = await callRpc('send_squad_invite', { p_user_id: userId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function respondSquadInvite(
  requestId: string,
  accept: boolean
): Promise<{ error: SquadApiError | null }> {
  const { error } = await callRpc('respond_squad_invite', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function cancelSquadInvite(
  requestId: string
): Promise<{ error: SquadApiError | null }> {
  const { error } = await callRpc('cancel_squad_invite', { p_request_id: requestId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function removeSquadFriend(userId: string): Promise<{ error: SquadApiError | null }> {
  const { error } = await callRpc('remove_squad_friend', { p_user_id: userId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function fetchSquadInvitePreview(
  inviteCode: string
): Promise<{ data: SquadInvitePreview | null; error: SquadApiError | null }> {
  const code = inviteCode.trim();
  if (!code) {
    return { data: null, error: { message: 'That invite link is not valid.' } };
  }

  const { data, error } = await callRpc('squad_invite_preview', { p_invite_code: code });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const row = readRecord(data);
  const username = readString(row.username);
  const nickname = readString(row.nickname);
  if (!username && !nickname) {
    return { data: null, error: { message: 'That invite is not available.' } };
  }

  return { data: { username, nickname }, error: null };
}

export async function acceptSquadInviteCode(
  inviteCode: string
): Promise<{ error: SquadApiError | null }> {
  const code = inviteCode.trim();
  if (!code) {
    return { error: { message: 'That invite link is not valid.' } };
  }

  const { error } = await callRpc('accept_squad_invite_code', { p_invite_code: code });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

/**
 * Retires the current personal invite link and issues a new one. The old link
 * stops working immediately, which is the only way back once a link has been
 * shared somewhere the athlete did not intend.
 */
export async function rotateSquadInviteCode(): Promise<{
  data: string | null;
  error: SquadApiError | null;
}> {
  const { data, error } = await callRpc('rotate_squad_invite_code');
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const code = readString(readRecord(data).invite_code);
  if (!code) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  return { data: code, error: null };
}
