export interface WorkoutExercise {
  name: string;
  target?: number;
  unit?: string;
}

export interface CreateMissionInput {
  nickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string;
  /** Snapshot intensity 1–5; custom workouts should pass 2. */
  intensityTier?: number;
  /** ISO timestamptz; omit for Start now. */
  scheduledAt?: string;
}

export interface CreateMissionResult {
  missionId: string;
  hostToken: string;
  participantId: string;
  claimToken: string;
}

export interface JoinMissionInput {
  missionId: string;
  nickname: string;
}

export interface JoinMissionResult {
  participantId: string;
  claimToken: string | null;
  hostToken: string | null;
  nickname: string;
  role: string;
}
