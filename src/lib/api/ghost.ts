import { callRpc } from '@/lib/api/callRpc';
import { computeBaseScore } from '@/lib/scoring/computeBaseScore';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';

export interface GhostRunRef {
  sessionId: string;
  participantId: string;
  nickname: string;
  finalScore: number;
  baseScore: number;
  createdAt: string;
}

export interface AvailableGhosts {
  personalBest: GhostRunRef | null;
  friends: GhostRunRef[];
}

export interface GhostCurveRound {
  roundIndex: number;
  elapsedSecAtRound: number;
}

export interface GhostCurveData {
  sessionId: string;
  participantId: string;
  segmentIndex: number;
  durationSec: number;
  repsPerRound: number;
  partialReps: number;
  terminalReps: number;
  rounds: GhostCurveRound[];
}

export type GhostApiError = {
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
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseGhostRunRef(raw: unknown): GhostRunRef | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const sessionId = readString(row.session_id);
  const participantId = readString(row.participant_id);
  const nickname = readString(row.nickname);
  const finalScore = readNumber(row.final_score);
  const baseScore = readNumber(row.base_score);
  const createdAt = readString(row.created_at);

  if (
    !sessionId ||
    !participantId ||
    !nickname ||
    finalScore === null ||
    baseScore === null ||
    !createdAt
  ) {
    return null;
  }

  return {
    sessionId,
    participantId,
    nickname,
    finalScore,
    baseScore,
    createdAt,
  };
}

function parseGhostCurveRound(raw: unknown): GhostCurveRound | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const roundIndex = readNumber(row.round_index);
  const elapsedSecAtRound = readNumber(row.elapsed_sec_at_round);

  if (roundIndex === null || elapsedSecAtRound === null) {
    return null;
  }

  return { roundIndex, elapsedSecAtRound };
}

export async function fetchAvailableGhosts(
  templateId: string,
  durationMinutes: number
): Promise<{ data: AvailableGhosts | null; error: GhostApiError | null }> {
  const { data, error } = await callRpc('available_ghosts', {
    p_template_id: templateId,
    p_duration_minutes: durationMinutes,
  });

  if (error) {
    if (error.message.includes('Authentication required')) {
      return {
        data: null,
        error: { message: 'Sign in to race your personal best.' },
      };
    }
    return { data: null, error: { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const personalBest = parseGhostRunRef(raw.personal_best);
  const friendsRaw = Array.isArray(raw.friends) ? raw.friends : [];
  const friends = friendsRaw
    .map((entry) => parseGhostRunRef(entry))
    .filter((entry): entry is GhostRunRef => entry !== null);

  return {
    data: { personalBest, friends },
    error: null,
  };
}

export async function fetchGhostCurveData(
  sessionId: string,
  participantId: string
): Promise<{ data: GhostCurveData | null; error: GhostApiError | null }> {
  const { data, error } = await callRpc('ghost_curve_data', {
    p_session_id: sessionId,
    p_participant_id: participantId,
  });

  if (error) {
    if (error.message.includes('Authentication required')) {
      return {
        data: null,
        error: { message: 'Sign in to load ghost pacing data.' },
      };
    }
    return { data: null, error: { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    const reason = readString(raw.reason);
    if (reason === 'forbidden') {
      return { data: null, error: { message: 'You cannot access this ghost run.' } };
    }
    if (reason === 'participant_not_found' || reason === 'session_not_found') {
      return { data: null, error: { message: 'Ghost run not found.' } };
    }
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const parsedSessionId = readString(raw.session_id);
  const parsedParticipantId = readString(raw.participant_id);
  const segmentIndex = readNumber(raw.segment_index) ?? 0;
  const durationMinutes = readNumber(raw.duration_minutes);
  const partialReps = readNumber(raw.partial_reps) ?? 0;
  const workout = raw.workout;

  if (!parsedSessionId || !parsedParticipantId || durationMinutes === null) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  if (!Array.isArray(workout)) {
    return {
      data: null,
      error: { message: 'Invalid ghost workout data.' },
    };
  }

  let repsPerRound: number;
  try {
    repsPerRound = computeRepsPerRound(workout);
  } catch {
    return {
      data: null,
      error: { message: 'Invalid ghost workout data.' },
    };
  }

  const roundsRaw = Array.isArray(raw.rounds) ? raw.rounds : [];
  const rounds = roundsRaw
    .map((entry) => parseGhostCurveRound(entry))
    .filter((entry): entry is GhostCurveRound => entry !== null);

  const terminalReps = computeBaseScore(rounds.length, partialReps, repsPerRound);

  return {
    data: {
      sessionId: parsedSessionId,
      participantId: parsedParticipantId,
      segmentIndex,
      durationSec: durationMinutes * 60,
      repsPerRound,
      partialReps,
      terminalReps,
      rounds,
    },
    error: null,
  };
}
