export interface WorkoutExercise {
  name: string;
  target?: number;
  unit?: string;
}

export interface CreateSessionInput {
  nickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
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
