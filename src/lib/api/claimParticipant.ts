import type { ClaimStatus } from '@/lib/claim/resolveClaimStatus';
import { callRpc } from '@/lib/api/callRpc';

export interface ClaimParticipantInput {
  participantId: string;
  claimToken: string;
}

export interface ClaimParticipantSuccess {
  ok: true;
  participantId: string;
  missionId: string;
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
    return 'Sign in to save this mission to your account.';
  }
  if (message.includes('Participant not found')) {
    return 'Participant not found.';
  }
  if (message.includes('Invalid claim')) {
    return 'Could not save mission. Try again.';
  }
  if (message.includes('Could not find the function') || message.includes('PGRST202')) {
    return 'Claim status check is unavailable on this Supabase project.';
  }
  return message;
}

export async function claimParticipant(input: ClaimParticipantInput): Promise<{
  data: ClaimParticipantResult | null;
  error: ClaimParticipantApiError | null;
}> {
  const { data, error } = await callRpc('claim_participant', {
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const ok = raw.ok === true;

  if (!ok) {
    const reason = readString(raw.reason) ?? 'unknown';
    return {
      data: { ok: false, reason },
      error: null,
    };
  }

  const participantId = readString(raw.participant_id);
  const missionId = readString(raw.mission_id);
  const userId = readString(raw.user_id);

  if (!participantId || !missionId || !userId) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      ok: true,
      participantId,
      missionId,
      userId,
      alreadyClaimed: raw.already_claimed === true,
    },
    error: null,
  };
}

type ResolvedClaimStatus = Exclude<ClaimStatus, 'unknown'>;

function readClaimStatus(value: unknown): ResolvedClaimStatus | null {
  if (value === 'claimable' || value === 'claimed' || value === 'claimed_by_other') {
    return value;
  }
  return null;
}

export async function fetchParticipantClaimStatus(participantId: string): Promise<{
  data: { ok: true; status: ResolvedClaimStatus } | { ok: false; reason: string } | null;
  error: ClaimParticipantApiError | null;
}> {
  const { data, error } = await callRpc('get_participant_claim_status', {
    p_participant_id: participantId,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    const reason = readString(raw.reason) ?? 'unknown';
    return { data: { ok: false, reason }, error: null };
  }

  const status = readClaimStatus(raw.status);
  if (!status) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { data: { ok: true, status }, error: null };
}
