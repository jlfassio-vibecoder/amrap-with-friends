import { supabase } from '@/lib/supabase';
import { persistSessionIdentity } from '@/lib/sessionIdentity';
import type {
  CreateSessionInput,
  CreateSessionResult,
  JoinSessionInput,
  JoinSessionResult,
} from '@/lib/api/sessionTypes';

export type SessionApiError = {
  message: string;
};

const SESSION_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSessionIdUuid(value: string): boolean {
  return SESSION_ID_UUID_RE.test(value);
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (
    message.includes('invalid input syntax for type uuid') ||
    message.toLowerCase().includes('invalid uuid')
  ) {
    return 'Enter a valid session ID (UUID format).';
  }
  if (message.includes('Session is full')) {
    return 'This session is full.';
  }
  if (message.includes('Session not found')) {
    return 'Session not found. Check the session ID and try again.';
  }
  if (message.includes('nickname')) {
    return 'Enter your name or a nickname (max 50 characters).';
  }
  if (message.includes('Duration')) {
    return 'Choose a duration between 1 and 60 minutes.';
  }
  if (message.includes('workout')) {
    return 'Check your workout list and try again.';
  }
  return message;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createSession(
  input: CreateSessionInput
): Promise<{ data: CreateSessionResult | null; error: SessionApiError | null }> {
  const nickname = input.nickname.trim();
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const { data, error } = await supabase.rpc('create_session', {
    p_duration_minutes: input.durationMinutes,
    p_nickname: nickname,
    p_workout: input.workout,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const sessionId = readString(raw.session_id);
  const hostToken = readString(raw.host_token);
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);

  if (!sessionId || !hostToken || !participantId || !claimToken) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistSessionIdentity(sessionId, {
    nickname,
    participantId,
    hostToken,
    claimToken,
  });

  return {
    data: { sessionId, hostToken, participantId, claimToken },
    error: null,
  };
}

export async function joinSession(
  input: JoinSessionInput
): Promise<{ data: JoinSessionResult | null; error: SessionApiError | null }> {
  const sessionId = input.sessionId.trim();
  const nickname = input.nickname.trim();

  if (!sessionId) {
    return { data: null, error: { message: 'Enter a session ID.' } };
  }
  if (!isSessionIdUuid(sessionId)) {
    return {
      data: null,
      error: { message: 'Enter a valid session ID (UUID format).' },
    };
  }
  if (!nickname) {
    return { data: null, error: { message: 'Enter your name or a nickname.' } };
  }

  const { data, error } = await supabase.rpc('join_session', {
    p_session_id: sessionId,
    p_nickname: nickname,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const participantId = readString(raw.participant_id);
  const claimToken = readString(raw.claim_token);

  if (!participantId || !claimToken) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  if ('host_token' in raw && readString(raw.host_token)) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  persistSessionIdentity(sessionId, {
    nickname,
    participantId,
    claimToken,
  });

  return {
    data: { participantId, claimToken },
    error: null,
  };
}
