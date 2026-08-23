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
  focus?: string;
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
    description:
      'Muscular Overload — stacks two or three movements targeting the same primary movers to force local muscular failure before cardiovascular failure.',
    availableForDurations: [5],
  },
  {
    id: 'engine-room',
    label: 'Engine Room',
    description:
      'Pure Cardio — zero muscular bottlenecks, only lung capacity and mental fortitude. High-velocity, low-resistance movements requiring constant, unbroken rhythm.',
    availableForDurations: [5],
  },
  {
    id: 'midline-tension',
    label: 'Midline Tension',
    description:
      'Dynamic Core — pairs a cardiovascular movement with strict, controlled core work. A fatigued core makes everything else feel twice as hard.',
    availableForDurations: [5],
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
  {
    id: 'the-acid-bath',
    name: 'The Acid Bath',
    focus: 'Quads',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Jump Squats', reps: 8 },
      { name: 'Air Squats', reps: 12 },
      { name: 'Bottom Squat Hold', reps: 10, unit: 'sec' },
    ],
    tacticalNote:
      'The active hold at the end traps lactic acid. Keep the chest tall during the hold.',
  },
  {
    id: 'the-press-gauntlet',
    name: 'The Press Gauntlet',
    focus: 'Chest/Tris',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Hand-Release Push-ups', reps: 6 },
      { name: 'Standard Push-ups', reps: 8 },
    ],
    tacticalNote:
      'The moment your hips sag, drop to your knees. Intensity requires integrity of the spine.',
  },
  {
    id: 'deltoid-demise',
    name: 'Deltoid Demise',
    focus: 'Shoulders',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Pike Push-ups', reps: 8 },
      { name: 'Commando Planks', reps: 12 },
    ],
    tacticalNote:
      'Brutal on the anterior shoulder. Lock the elbows out completely at the top of every rep.',
  },
  {
    id: 'core-melt',
    name: 'Core Melt',
    focus: 'Midline',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'V-Ups', reps: 10 },
      { name: 'Butterfly Sit-ups', reps: 15 },
      { name: 'Hollow Hold', reps: 15, unit: 'sec' },
    ],
    tacticalNote:
      'The hollow hold must be strictly enforced: lower back pinned violently to the floor.',
  },
  {
    id: 'quadra-kill',
    name: 'Quadra-Kill',
    focus: 'Legs',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Jumping Lunges (Total)', reps: 12 },
      { name: 'Reverse Lunges (Total)', reps: 12 },
    ],
    tacticalNote:
      'Going from plyometric to static destroys the legs. Do not rest at the top; drop right back down.',
  },
  {
    id: 'tricep-guillotine',
    name: 'Tricep Guillotine',
    focus: 'Arms',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Sphinx Push-ups (Forearm to hand)', reps: 6 },
      { name: 'Floor Dips', reps: 12 },
    ],
    tacticalNote:
      'Triceps will fail suddenly. Keep the hands under the shoulders, not out wide.',
  },
  {
    id: 'posterior-panic',
    name: 'Posterior Panic',
    focus: 'Glutes',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Single-Leg Glute Bridges (5/leg)', reps: 10 },
      { name: 'Standard Glute Bridges', reps: 15 },
    ],
    tacticalNote:
      'Squeeze at the top of every rep. If you feel this in your lower back, your core is disengaged.',
  },
  {
    id: 'the-sidewinder',
    name: 'The Sidewinder',
    focus: 'Obliques',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Side Plank Dips (Left)', reps: 10 },
      { name: 'Side Plank Dips (Right)', reps: 10 },
    ],
    tacticalNote:
      'Stack the feet and drop the hip fully to the floor. No flopping. Control the descent.',
  },
  {
    id: 'pectoral-panic',
    name: 'Pectoral Panic',
    focus: 'Chest',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Diamond Push-ups', reps: 5 },
      { name: 'Standard Push-ups', reps: 5 },
      { name: 'Wide Push-ups', reps: 5 },
    ],
    tacticalNote:
      'A mechanical drop-set. Try to complete all 15 reps unbroken before resting on your knees.',
  },
  {
    id: 'the-springboard',
    name: 'The Springboard',
    focus: 'Calves',
    durationMinutes: 5,
    category: 'localized-trap',
    movements: [
      { name: 'Pogo Jumps', reps: 20 },
      { name: 'Fast Calf Raises', reps: 20 },
    ],
    tacticalNote:
      'Legs stay perfectly straight on the pogos; bounce strictly from the ankles.',
  },
  {
    id: 'the-gas-pedal',
    name: 'The Gas Pedal',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Burpees', reps: 10 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'The classic engine tester. Find a breathing rhythm on the jacks to recover from the burpees.',
  },
  {
    id: 'redline',
    name: 'Redline',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Mountain Climbers (Total)', reps: 30 },
      { name: 'High Knees (Total)', reps: 30 },
    ],
    tacticalNote:
      "Pure leg turnover. Knees must break the waistline on the high knees or it's a fake rep.",
  },
  {
    id: 'the-sprinters-tax',
    name: "The Sprinter's Tax",
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Sprawls (No-Push-up Burpees)', reps: 12 },
      { name: 'Lateral Line Hops', reps: 20 },
    ],
    tacticalNote:
      'Fast, violent hip extensions. Pick a line on the floor and jump over it with both feet together.',
  },
  {
    id: 'lateral-combustion',
    name: 'Lateral Combustion',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Skater Jumps (Total)', reps: 15 },
      { name: 'Jumping Jacks', reps: 15 },
    ],
    tacticalNote:
      'Constant side-to-side velocity. Stay light on the balls of your feet to minimize ground contact time.',
  },
  {
    id: 'the-phantom-rope',
    name: 'The Phantom Rope',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Double-Tap Jumps (Penguin Taps)', reps: 30 },
      { name: 'Down-Ups', reps: 10 },
    ],
    tacticalNote:
      'Simulates double-unders without a rope. Tap your thighs twice at the apex of every jump.',
  },
  {
    id: 'the-turbine',
    name: 'The Turbine',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'High Knees (Total)', reps: 20 },
      { name: 'Butt Kicks (Total)', reps: 20 },
      { name: 'Jump Squats', reps: 10 },
    ],
    tacticalNote:
      'A continuous cycle of lower-body plyometrics. Breathe in through the nose, out through the mouth.',
  },
  {
    id: 'cross-current',
    name: 'Cross-Current',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Cross-Body Mountain Climbers', reps: 20 },
      { name: 'Sprawls', reps: 10 },
    ],
    tacticalNote:
      'Drives rotational heart rate. Drive the right knee to the left elbow. Keep the hips low.',
  },
  {
    id: 'the-boomerang',
    name: 'The Boomerang',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Broad Jumps (With backpedal return)', reps: 5 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'Explode forward, stay low on the backpedal. This spikes the heart rate faster than running in place.',
  },
  {
    id: 'rapid-fire',
    name: 'Rapid Fire',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Half-Burpees (Plank to squat stance)', reps: 15 },
      { name: 'Jumping Jacks', reps: 15 },
    ],
    tacticalNote:
      'Eliminates the chest-to-deck and the jump. It is all hip-hinge speed. Do not let the lower back sag in the plank.',
  },
  {
    id: 'the-escalator',
    name: 'The Escalator',
    durationMinutes: 5,
    category: 'engine-room',
    movements: [
      { name: 'Burpees', reps: 5 },
      { name: 'Mountain Climbers', reps: 10 },
      { name: 'Jumping Jacks', reps: 15 },
    ],
    tacticalNote:
      'A cascading rep scheme that flows beautifully. Use the 15 jacks as your active recovery.',
  },
  {
    id: 'the-folding-knife',
    name: 'The Folding Knife',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Sprawls', reps: 10 },
      { name: 'V-Ups', reps: 10 },
    ],
    tacticalNote:
      'Explosive hip extension immediately into extreme hip flexion. Keep the legs locked straight on the V-ups.',
  },
  {
    id: 'the-hull-breach',
    name: 'The Hull Breach',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Burpees', reps: 8 },
      { name: 'Hollow Rocks', reps: 15 },
    ],
    tacticalNote:
      'Breathing heavily during a hollow rock feels like suffocating. Pin the lower back to the floor and fight for position.',
  },
  {
    id: 'the-vice-grip',
    name: 'The Vice Grip',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Mountain Climbers', reps: 20 },
      { name: 'Strict Sit-Ups', reps: 10 },
    ],
    tacticalNote:
      'Do not use momentum to throw yourself up on the sit-ups. Roll up one vertebrae at a time.',
  },
  {
    id: 'the-shock-absorber',
    name: 'The Shock Absorber',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Jump Squats', reps: 10 },
      { name: 'Plank Knee-to-Elbows', reps: 12 },
    ],
    tacticalNote:
      'Forcefully compress the obliques. The knee must physically touch the triceps for the rep to count.',
  },
  {
    id: 'the-tornado',
    name: 'The Tornado',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Jumping Jacks', reps: 15 },
      { name: 'Bicycle Crunches', reps: 20 },
    ],
    tacticalNote:
      'A deceptive trap. Keep the elbows wide and rotate from the sternum, not the neck.',
  },
  {
    id: 'the-contrast',
    name: 'The Contrast',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Tuck Jumps', reps: 8 },
      { name: 'Dead Bugs', reps: 12 },
    ],
    tacticalNote:
      'Maximum chaos moving to maximum control. Breathe out sharply as the opposite arm and leg extend.',
  },
  {
    id: 'the-iron-pendulum',
    name: 'The Iron Pendulum',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Skater Jumps', reps: 12 },
      { name: 'Russian Twists', reps: 20 },
    ],
    tacticalNote:
      'Rotational stability under fire. Touch both hands to the floor outside the hip on every single twist.',
  },
  {
    id: 'anti-gravity',
    name: 'Anti-Gravity',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Down-Ups', reps: 10 },
      { name: 'Leg Raises', reps: 10 },
    ],
    tacticalNote:
      "Control the descent of the legs. If your heels slam into the floor, the rep doesn't count.",
  },
  {
    id: 'the-scissors',
    name: 'The Scissors',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'High Knees', reps: 20 },
      { name: 'Flutter Kicks', reps: 20 },
    ],
    tacticalNote:
      'Lightning-fast transitions. Keep the chin tucked during the flutter kicks to deeply engage the upper abdominals.',
  },
  {
    id: 'the-coil',
    name: 'The Coil',
    durationMinutes: 5,
    category: 'midline-tension',
    movements: [
      { name: 'Plank Jacks', reps: 10 },
      { name: 'Superman Raises', reps: 10 },
    ],
    tacticalNote:
      'Remember the posterior core. Lift the chest and thighs off the floor simultaneously, squeezing the lower back.',
  },
];
