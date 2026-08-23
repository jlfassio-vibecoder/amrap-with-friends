export type TimeDomain = 5 | 10 | 15 | 20;

export type WorkoutCategory =
  | 'blood-shunt'
  | 'localized-trap'
  | 'engine-room'
  | 'midline-tension';

export interface WorkoutCategoryMeta {
  id: WorkoutCategory;
  label: string;
  description: string;
  availableForDurations: TimeDomain[];
}

export interface WorkoutTemplateMovement {
  name: string;
  reps?: number;
  unit?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  durationMinutes: TimeDomain;
  category: WorkoutCategory | null;
  movements: WorkoutTemplateMovement[];
  tacticalNote: string;
}

export const TIME_DOMAINS: TimeDomain[] = [5, 10, 15, 20];

export const WORKOUT_CATEGORIES: WorkoutCategoryMeta[] = [
  {
    id: 'blood-shunt',
    label: 'Blood Shunt',
    description:
      'Peripheral Heart Action — pairs a high-output lower body movement directly with an upper body movement. Fast, breathless, chaotic.',
    availableForDurations: [5],
  },
  {
    id: 'localized-trap',
    label: 'Localized Trap',
    description: 'Muscular overload — isolate and fatigue specific muscle groups under time pressure.',
    availableForDurations: [],
  },
  {
    id: 'engine-room',
    label: 'Engine Room',
    description: 'Pure cardio — sustained high-output movements with minimal rest between transitions.',
    availableForDurations: [],
  },
  {
    id: 'midline-tension',
    label: 'Midline Tension',
    description: 'Dynamic core — rotational and anti-extension work under cardiovascular duress.',
    availableForDurations: [],
  },
];

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'the-piston',
    name: 'The Piston',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Air Squats', reps: 10 },
      { name: 'Hand-Release Push-ups', reps: 10 },
    ],
    tacticalNote:
      'The baseline test. Hips open fully at the top of the squat, chest rests dead on the floor.',
  },
  {
    id: 'shock-and-awe',
    name: 'Shock & Awe',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Jump Squats', reps: 10 },
      { name: 'Plank Shoulder Taps', reps: 20 },
    ],
    tacticalNote:
      'Spikes the heart rate immediately. Widen the feet on the shoulder taps to prevent hip sway.',
  },
  {
    id: 'the-pendulum',
    name: 'The Pendulum',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Alternating Lunges', reps: 12 },
      { name: 'Pike Push-ups', reps: 8 },
    ],
    tacticalNote:
      'Demands balance and shoulder stability while breathless. Kiss the back knee gently to the floor.',
  },
  {
    id: 'system-override',
    name: 'System Override',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Tuck Jumps', reps: 10 },
      { name: 'Commando Planks (Up-Downs)', reps: 10 },
    ],
    tacticalNote: 'High neurological demand. Knees must break the hip crease on the jumps.',
  },
  {
    id: 'gravity-well',
    name: 'Gravity Well',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Glute Bridges', reps: 15 },
      { name: 'Diamond Push-ups', reps: 10 },
    ],
    tacticalNote:
      'Rapid transition from supine to prone. Squeeze the glutes aggressively; protect the triceps.',
  },
  {
    id: 'flash-flood',
    name: 'Flash Flood',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Skater Jumps (Total)', reps: 12 },
      { name: 'Wide-Grip Push-ups', reps: 10 },
    ],
    tacticalNote: 'Lateral lower-body power paired with horizontal upper-body pressing.',
  },
  {
    id: 'the-see-saw',
    name: 'The See-Saw',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Surrenders (Kneel-to-Stand)', reps: 10 },
      { name: 'Plank Jacks', reps: 15 },
    ],
    tacticalNote:
      'Burns the quads and the core simultaneously. Keep the chest proud on the surrenders.',
  },
  {
    id: 'pulse-spike',
    name: 'Pulse Spike',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Jumping Lunges (Total)', reps: 12 },
      { name: 'Dive-Bomber Push-ups', reps: 8 },
    ],
    tacticalNote:
      'Devastating. If the jumping lunges degrade into sloppy steps, regress to strict reverse lunges.',
  },
  {
    id: 'the-metronome',
    name: 'The Metronome',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Fast Air Squats', reps: 15 },
      { name: 'T-Push-ups (Rotate & Reach)', reps: 10 },
    ],
    tacticalNote: 'Focuses on rotational stability under heavy cardiovascular duress.',
  },
  {
    id: 'whiplash',
    name: 'Whiplash',
    durationMinutes: 5,
    category: 'blood-shunt',
    movements: [
      { name: 'Broad Jumps (Turn and repeat)', reps: 8 },
      { name: 'Standard Push-ups', reps: 12 },
    ],
    tacticalNote: 'Pure explosive power. Land soft on the jumps, rigid body on the push-ups.',
  },
];
