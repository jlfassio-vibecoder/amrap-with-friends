/** The shape `get_mission_replay` returns, normalised. One frame of this is a card; six hundred are a replay. */
export interface ReplayMission {
  id: string;
  templateId: string | null;
  workout: unknown;
  capSeconds: number;
  durationMinutes: number;
  intensityTier: number | null;
  state: string;
  startedAt: string | null;
  segmentIndex: number;
}

export interface ReplayParticipant {
  participantId: string;
  userId: string | null;
  /** Already resolved against share_visibility in SQL — never a hidden athlete's real name. */
  displayName: string;
  isMe: boolean;
  finalRounds: number;
  finalReps: number;
  role: string;
}

export interface ReplayRound {
  participantId: string;
  n: number;
  /** Seconds from mission start, read from rounds.elapsed_sec_at_round and clamped to the cap. */
  atSeconds: number;
}

export interface ReplayData {
  mission: ReplayMission;
  participants: ReplayParticipant[];
  rounds: ReplayRound[];
}

export type ShareLayout = 'story' | 'square' | 'landscape';
export type ShareVariant = 'result' | 'squad' | 'pr' | 'amqap';
