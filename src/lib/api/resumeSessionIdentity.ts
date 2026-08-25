import { supabase } from '@/lib/supabase';
import { persistSessionIdentity } from '@/lib/sessionIdentity';

export type ResumeSessionIdentityResult = {
  participantId: string;
  nickname: string;
  role: string;
  hostToken: string | null;
};

export type ResumeSessionIdentityError = {
  message: string;
};

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
  if (message.includes('Authentication required')) {
    return 'Sign in to reopen this session.';
  }
  return message;
}

export async function resumeSessionIdentity(sessionId: string): Promise<{
  data: ResumeSessionIdentityResult | null;
  missing: boolean;
  error: ResumeSessionIdentityError | null;
}> {
  const { data, error } = await supabase.rpc('resume_session_identity', {
    p_session_id: sessionId,
  });

  if (error) {
    return {
      data: null,
      missing: false,
      error: { message: mapRpcError(error.message) },
    };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok === false) {
    return { data: null, missing: true, error: null };
  }

  if (raw.ok !== true) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const participantId = readString(raw.participantId);
  const nickname = readString(raw.nickname);
  const role = readString(raw.role) ?? 'joiner';
  const hostToken = role === 'host' ? readString(raw.hostToken) : null;

  if (!participantId || !nickname) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  persistSessionIdentity(sessionId, {
    participantId,
    nickname,
    ...(hostToken ? { hostToken } : {}),
  });

  return {
    data: { participantId, nickname, role, hostToken },
    missing: false,
    error: null,
  };
}
