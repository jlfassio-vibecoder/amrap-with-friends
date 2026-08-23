export interface ExercisePhoto {
  url: string;
  caption: string;
}

export interface ExerciseInfo {
  id: string;
  name: string;
  setupAndExecution: string[];
  commonMistakes: string[];
  coachingCue: string;
  photos: ExercisePhoto[];
  videoUrl?: string;
}

export const EXERCISE_LIBRARY: ExerciseInfo[] = [
  {
    id: 'burpees',
    name: 'Burpees',
    setupAndExecution: [
      'Stand with feet shoulder-width apart.',
      'Drop into a squat, place hands on the floor.',
      'Kick both feet back into a plank position.',
      'Perform a push-up (optional), then jump feet back to hands.',
      'Explode upward into a jump, arms overhead.',
    ],
    commonMistakes: [
      'Sagging hips in the plank position.',
      'Skipping the full hip extension on the jump.',
    ],
    coachingCue:
      "Land soft, chest up. If your lower back rounds on the way down, slow down — form breaks down fast when you're gassed.",
    photos: [],
  },
];

export function getExerciseInfo(name: string): ExerciseInfo | undefined {
  const normalized = name.trim().toLowerCase();
  return EXERCISE_LIBRARY.find((entry) => entry.name.toLowerCase() === normalized);
}
