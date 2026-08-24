export interface WorkoutExercise {
  name: string;
  target?: number;
  unit?: string;
}

export interface CreateSessionInput {
  nickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string;
  /** Snapshot intensity 1–5; custom workouts should pass 2. */
  intensityTier?: number;
}

export interface CreateSessionResult {
  sessionId: string;
  hostToken: string;
  participantId: string;
  claimToken: string;
}

export interface JoinSessionInput {
  sessionId: string;
  nickname: string;
}

export interface JoinSessionResult {
  participantId: string;
  claimToken: string;
}
