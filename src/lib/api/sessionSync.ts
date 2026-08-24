import { supabase } from '@/lib/supabase';
import type {
  LiveSessionPhase,
  LogRoundInput,
  LogRoundResult,
  SubmitParticipantResultInput,
  SubmitParticipantResultResult,
  UpdateSessionStateInput,
  UpdateSessionStateResult,
} from '@/lib/sessionSync/types';

export type SessionSyncApiError = {
  message: string;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function isLiveSessionPhase(value: string): value is LiveSessionPhase {
  return (
    value === 'waiting' ||
    value === 'setup' ||
    value === 'work' ||
    value === 'finished'
  );
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Session not found')) {
    return 'Session not found.';
  }
  if (message.includes('Invalid session state')) {
    return 'Invalid session state.';
  }
  if (message.includes('Invalid time_left_sec')) {
    return 'Invalid timer state.';
  }
  if (message.includes('Invalid round log')) {
    return 'Could not log round. Please try again.';
  }
  if (message.includes('Participant not found')) {
    return 'Participant not found.';
  }
  if (message.includes('Invalid partial')) {
    return 'Invalid partial rep count.';
  }
  return message;
}

export async function updateSessionState(
  input: UpdateSessionStateInput
): Promise<{
  data: UpdateSessionStateResult | null;
  error: SessionSyncApiError | null;
}> {
  const { data, error } = await supabase.rpc('update_session_state', {
    p_session_id: input.sessionId,
    p_host_token: input.hostToken,
    p_state: input.state,
    p_time_left_sec: input.timeLeftSec,
    p_is_paused: input.isPaused,
    p_started_at: input.startedAt ?? null,
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

  const sessionId = readString(raw.session_id);
  const state = readString(raw.state);
  const timeLeftSec = readNumber(raw.time_left_sec);
  const isPaused = readBoolean(raw.is_paused);
  const segmentIndex = readNumber(raw.segment_index);

  if (
    !sessionId ||
    !state ||
    !isLiveSessionPhase(state) ||
    timeLeftSec === null ||
    isPaused === null ||
    segmentIndex === null
  ) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const startedAtRaw = raw.started_at;
  const startedAt =
    startedAtRaw === null || startedAtRaw === undefined
      ? null
      : readString(String(startedAtRaw));

  return {
    data: {
      ok: true,
      sessionId,
      state,
      timeLeftSec,
      isPaused,
      startedAt,
      segmentIndex,
    },
    error: null,
  };
}

export async function logRound(
  input: LogRoundInput
): Promise<{ data: LogRoundResult | null; error: SessionSyncApiError | null }> {
  const { data, error } = await supabase.rpc('log_round', {
    p_session_id: input.sessionId,
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
    p_round_index: input.roundIndex,
    p_elapsed_sec_at_round: input.elapsedSecAtRound,
    p_segment_index: input.segmentIndex,
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

  const roundId = readString(raw.round_id);
  const roundIndex = readNumber(raw.round_index);
  const elapsedSecAtRound = readNumber(raw.elapsed_sec_at_round);
  const segmentIndex = readNumber(raw.segment_index);

  if (
    !roundId ||
    roundIndex === null ||
    elapsedSecAtRound === null ||
    segmentIndex === null
  ) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      ok: true,
      roundId,
      roundIndex,
      elapsedSecAtRound,
      segmentIndex,
    },
    error: null,
  };
}

export async function submitParticipantResult(
  input: SubmitParticipantResultInput
): Promise<{
  data: SubmitParticipantResultResult | null;
  error: SessionSyncApiError | null;
}> {
  const { data, error } = await supabase.rpc('submit_participant_result', {
    p_session_id: input.sessionId,
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
    p_partial_reps: input.partialReps,
    p_segment_index: input.segmentIndex,
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
  const segmentIndex = readNumber(raw.segment_index);
  const partialReps = readNumber(raw.partial_reps);
  const repsPerRound = readNumber(raw.reps_per_round);

  if (
    !participantId ||
    segmentIndex === null ||
    partialReps === null ||
    repsPerRound === null
  ) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      ok: true,
      participantId,
      segmentIndex,
      partialReps,
      repsPerRound,
    },
    error: null,
  };
}
