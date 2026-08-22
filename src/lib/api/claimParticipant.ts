import { supabase } from '@/lib/supabase';

export interface ClaimParticipantInput {
  participantId: string;
  claimToken: string;
}

export interface ClaimParticipantSuccess {
  ok: true;
  participantId: string;
  sessionId: string;
  userId: string;
  alreadyClaimed: boolean;
}

export interface ClaimParticipantFailure {
  ok: false;
  reason: string;
}

export type ClaimParticipantResult = ClaimParticipantSuccess | ClaimParticipantFailure;

export type ClaimParticipantApiError = {
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
    return 'Sign in to save this session to your account.';
  }
  if (message.includes('Participant not found')) {
    return 'Participant not found.';
  }
  if (message.includes('Invalid claim')) {
    return 'Could not save session. Try again.';
  }
  return message;
}

export async function claimParticipant(
  input: ClaimParticipantInput
): Promise<{
  data: ClaimParticipantResult | null;
  error: ClaimParticipantApiError | null;
}> {
  const { data, error } = await supabase.rpc('claim_participant', {
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const ok = raw.ok === true;

  if (!ok) {
    const reason = readString(raw.reason) ?? 'unknown';
    return {
      data: { ok: false, reason },
      error: null,
    };
  }

  const participantId = readString(raw.participant_id);
  const sessionId = readString(raw.session_id);
  const userId = readString(raw.user_id);

  if (!participantId || !sessionId || !userId) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      ok: true,
      participantId,
      sessionId,
      userId,
      alreadyClaimed: raw.already_claimed === true,
    },
    error: null,
  };
}

export async function fetchParticipantUserId(
  participantId: string
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('participants')
    .select('user_id')
    .eq('id', participantId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  const userId = data.user_id;
  return typeof userId === 'string' ? userId : null;
}
