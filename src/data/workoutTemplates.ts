export type TimeDomain = 5 | 10 | 15 | 20;

/** Benchmark Matrix intensity (1 = recovery … 5 = Tier 1). */
export type IntensityTier = 1 | 2 | 3 | 4 | 5;

export type WorkoutCategory =
  | 'blood-shunt'
  | 'localized-trap'
  | 'engine-room'
  | 'midline-tension'
  | 'aerobic-matrix'
  | 'four-point-cascade'
  | 'armor-protocol';

export interface WorkoutCategoryMeta {
  id: WorkoutCategory;
  label: string;
  description: string;
  availableForDurations: TimeDomain[];
  overridesByDuration?: Partial<
    Record<
      TimeDomain,
      {
        label: string;
        description: string;
      }
    >
  >;
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
  intensityTier: IntensityTier;
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
    availableForDurations: [5, 10, 15],
    overridesByDuration: {
      10: {
        label: 'Aerobic Blood Shunt',
        description:
          'The format survives the time jump by shifting from couplets to triplets — a low-interference bridge movement keeps the heart rate redlined while blood physically travels from the upper to the lower extremities.',
      },
    },
  },
  {
    id: 'localized-trap',
    label: 'Localized Trap',
    description:
      'Muscular Overload — stacks two or three movements targeting the same primary movers to force local muscular failure before cardiovascular failure.',
    availableForDurations: [5, 10, 15],
    overridesByDuration: {
      10: {
        label: 'Push-Pull',
        description:
          'Anterior Chain versus Posterior Chain — without equipment, true pulling is a hinge-and-spinal-erector puzzle. Pair aggressive chest, shoulder, and quad pushing with heavy glute, hamstring, and posterior tension for a relentless 10-minute equilibrium that protects the joints while keeping the heart rate pinned.',
      },
      15: {
        label: 'Systemic Shift',
        description:
          'Strict triplets hit upper body, lower body, and midline sequentially so no single muscle group fails completely — systemic fatigue and the central nervous system strain of constantly shifting load become the ultimate crucible.',
      },
    },
  },
  {
    id: 'engine-room',
    label: 'Engine Room',
    description:
      'Pure Cardio — zero muscular bottlenecks, only lung capacity and mental fortitude. High-velocity, low-resistance movements requiring constant, unbroken rhythm.',
    availableForDurations: [5, 10, 15],
    overridesByDuration: {
      10: {
        label: 'Sustained Engine',
        description:
          'Gravity and impact are the enemy at 10 minutes — bounce for 600 seconds and your Achilles fail before your lungs. Sustained Engine swaps joint-destroying plyometrics for sweeping, rhythmic compound work to keep the heart rate redlined safely.',
      },
      15: {
        label: 'Sustained Engine',
        description:
          'Gravity and repetitive impact are the enemies at 15 minutes — pure plyometric bouncing will snap Achilles tendons before lungs fail. Sustained Engine uses sweeping, rhythmic compound triplets that demand heavy oxygen intake while protecting the joints.',
      },
    },
  },
  {
    id: 'midline-tension',
    label: 'Midline Tension',
    description:
      'Dynamic Core — pairs a cardiovascular movement with strict, controlled core work. A fatigued core makes everything else feel twice as hard.',
    availableForDurations: [5, 10, 15],
    overridesByDuration: {
      10: {
        label: 'Structural Grind',
        description:
          'Continuous spinal flexion for 10 minutes is a recipe for disaster. Structural Grind pairs rigid isometrics and slow anti-rotation with steady lower-body engine work so the abdominal wall stabilizes the spine under shifting loads and protects the lower back.',
      },
      15: {
        label: 'Structural Grind',
        description:
          'Continuous spinal flexion for 15 minutes is a recipe for disaster. Structural Grind pairs timed isometrics, slow anti-rotation, and posterior chain work with steady lower-body engine movements so the abdominal wall stabilizes the spine under shifting loads for the full core crucible.',
      },
    },
  },
  {
    id: 'aerobic-matrix',
    label: 'Aerobic Matrix',
    description:
      'The Quadruplet — four movements distribute fatigue globally so the cardiovascular system stays the sole bottleneck, letting you keep moving for the full 20 minutes without hitting a localized muscular wall.',
    availableForDurations: [20],
  },
  {
    id: 'four-point-cascade',
    label: '4-Point Cascade',
    description:
      'The Cascade — four movements sequenced to rotate stress through engine, push, legs, and midline so fatigue cascades through the body instead of pooling in one muscle group, keeping you moving for the full 20 minutes.',
    availableForDurations: [20],
  },
  {
    id: 'armor-protocol',
    label: 'Armor Protocol',
    description:
      'The Armor Protocol — every round begins with a rigid isometric hold that armors the spine and joints before dynamic work spikes the heart rate, turning structural tension into the pacing anchor for the full 20 minutes.',
    availableForDurations: [20],
  },
];

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'the-piston',
    name: 'The Piston',
    durationMinutes: 5,
    category: 'blood-shunt',
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
    movements: [
      { name: 'Broad Jumps (Turn and repeat)', reps: 8 },
      { name: 'Standard Push-ups', reps: 12 },
    ],
    tacticalNote: 'Pure explosive power. Land soft on the jumps, rigid body on the push-ups.',
  },
  {
    id: 'the-valve',
    name: 'The Valve',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Air Squats', reps: 15 },
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'The mountain climbers act as an active flush. Breathe rhythmically while in the plank.',
  },
  {
    id: 'arterial-shift',
    name: 'Arterial Shift',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Alternating Lunges (Total)', reps: 20 },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'Heavy leg volume followed by shoulder isolation. The jacks are pure active recovery.',
  },
  {
    id: 'the-regulator',
    name: 'The Regulator',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Glute Bridges', reps: 20 },
      { name: 'Standard Push-ups', reps: 10 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'Transitions smoothly from supine to prone to standing. Explode on the high knees.',
  },
  {
    id: 'high-tide',
    name: 'High Tide',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Jump Squats', reps: 12 },
      { name: 'Commando Planks', reps: 12 },
      { name: 'Lateral Line Hops', reps: 20 },
    ],
    tacticalNote:
      'High neurological fatigue. Focus on light, fast feet during the line hops to rest the quads.',
  },
  {
    id: 'the-centrifuge',
    name: 'The Centrifuge',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Surrenders', reps: 10 },
      { name: 'Dive-Bomber Push-ups', reps: 8 },
      { name: 'Double-Tap Jumps', reps: 30 },
    ],
    tacticalNote:
      'A devastating mix of slow, heavy tension and rapid plyometrics. Pace the surrenders.',
  },
  {
    id: 'vascular-drive',
    name: 'Vascular Drive',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Plank Shoulder Taps', reps: 12 },
      { name: 'Air Squats', reps: 15 },
    ],
    tacticalNote:
      'The air squats will feel surprisingly difficult after the sprawls. Push through the burn.',
  },
  {
    id: 'pressure-cooker',
    name: 'Pressure Cooker',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Broad Jumps', reps: 8 },
      { name: 'Wide Push-ups', reps: 10 },
      { name: 'Skater Jumps (Total)', reps: 20 },
    ],
    tacticalNote:
      'Explode horizontally, press horizontally, bound laterally. Multidirectional blood flow.',
  },
  {
    id: 'crimson-flow',
    name: 'Crimson Flow',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Bear Crawl to Broad Jumps', reps: 5 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'The butt kicks provide a necessary break for the upper body after the crawling and pressing.',
  },
  {
    id: 'the-diverter',
    name: 'The Diverter',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Reverse Lunges (Total)', reps: 16 },
      { name: 'Diamond Push-ups', reps: 8 },
      { name: 'Sprawls', reps: 10 },
    ],
    tacticalNote:
      'The sprawls will tax the core right after the triceps fail. Lock the plank tightly.',
  },
  {
    id: 'the-hemodynamic',
    name: 'The Hemodynamic',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Fast Air Squats', reps: 15 },
      { name: 'Down-Ups', reps: 10 },
      { name: 'Fast Calf Raises', reps: 20 },
    ],
    tacticalNote:
      'Constant up-and-down motion. The calf raises trap blood in the extreme lower leg before forcing it back to the chest.',
  },
  {
    id: 'the-long-haul',
    name: 'The Long Haul',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Air Squats', reps: 20 },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 40 },
    ],
    tacticalNote:
      'A pure aerobic triplet. Settle into a conversational pace immediately.',
  },
  {
    id: 'deep-circulation',
    name: 'Deep Circulation',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Reverse Lunges (Total)', reps: 20 },
      { name: 'Hand-Release Push-ups', reps: 12 },
      { name: 'Sprawls', reps: 20 },
    ],
    tacticalNote:
      'The sprawls will spike the heart rate; recover your breath during the lunges.',
  },
  {
    id: 'the-piston-grind',
    name: 'The Piston Grind',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Glute Bridges', reps: 20 },
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Slow, heavy tension on the floor before a rapid core flush.',
  },
  {
    id: 'sustained-pressure',
    name: 'Sustained Pressure',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Surrenders', reps: 16 },
      { name: 'Wide Push-ups', reps: 12 },
      { name: 'High Knees', reps: 30 },
    ],
    tacticalNote:
      'Manage your breathing on the surrenders. Keep the chest completely open.',
  },
  {
    id: 'the-marathon-shunt',
    name: 'The Marathon Shunt',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Commando Planks', reps: 16 },
      { name: 'Skater Jumps', reps: 30 },
    ],
    tacticalNote:
      'Constant elevation changes. Do not rush the commando planks.',
  },
  {
    id: 'aerobic-shift',
    name: 'Aerobic Shift',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Double-Tap Jumps', reps: 40 },
    ],
    tacticalNote:
      'Rotational pressing prevents early shoulder fatigue in this long domain.',
  },
  {
    id: 'the-steady-state',
    name: 'The Steady State',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Air Squats', reps: 20 },
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'Down-Ups', reps: 20 },
    ],
    tacticalNote:
      'Triceps will fatigue late. Break the push-ups into two sets of 5 early on.',
  },
  {
    id: 'arterial-endurance',
    name: 'Arterial Endurance',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Bear Crawl to Broad Jumps', reps: 8 },
      { name: 'Plank Shoulder Taps', reps: 16 },
      { name: 'Butt Kicks', reps: 40 },
    ],
    tacticalNote:
      'High time-under-tension. Keep the crawling deliberate and flat-backed.',
  },
  {
    id: 'the-metronome-endurance',
    name: 'The Metronome',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Single-Leg Glute Bridges (10/leg)', reps: 20 },
      { name: 'Standard Push-ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 40 },
    ],
    tacticalNote:
      'Isolate the glutes, then use the jacks to flush the entire system.',
  },
  {
    id: 'system-flush',
    name: 'System Flush',
    durationMinutes: 15,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: [
      { name: 'Reverse Lunges', reps: 16 },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'The shoulders will bear the brunt here. Stay stacked perfectly over your wrists.',
  },
  {
    id: 'the-acid-bath',
    name: 'The Acid Bath',
    focus: 'Quads',
    durationMinutes: 5,
    category: 'localized-trap',
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
    movements: [
      { name: 'Pogo Jumps', reps: 20 },
      { name: 'Fast Calf Raises', reps: 20 },
    ],
    tacticalNote:
      'Legs stay perfectly straight on the pogos; bounce strictly from the ankles.',
  },
  {
    id: 'the-see-saw-push-pull',
    name: 'The See-Saw',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'Supermans', reps: 15 },
      { name: 'Air Squats', reps: 20 },
    ],
    tacticalNote:
      'The squats act as an active flush while transitioning from anterior to posterior focus.',
  },
  {
    id: 'counterbalance',
    name: 'Counterbalance',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Glute Bridges', reps: 20 },
    ],
    tacticalNote:
      'Heavy shoulder pressing directly paired with heavy hamstring/glute hinging.',
  },
  {
    id: 'equilibrium',
    name: 'Equilibrium',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Standard Push-ups', reps: 12 },
      { name: 'Reverse Snow Angels', reps: 15 },
    ],
    tacticalNote:
      'Squeeze the shoulder blades aggressively on the snow angels to simulate a vertical pull.',
  },
  {
    id: 'the-hinge-and-press',
    name: 'The Hinge & Press',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Bodyweight Good Mornings', reps: 15 },
    ],
    tacticalNote:
      'Hands behind the head on the good mornings; hinge slowly until the hamstrings scream.',
  },
  {
    id: 'tension-shift',
    name: 'Tension Shift',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'Single-Leg Glute Bridges (Total)', reps: 16 },
    ],
    tacticalNote:
      'Triceps isolate the front; single-leg bridges violently isolate the back.',
  },
  {
    id: 'the-fulcrum',
    name: 'The Fulcrum',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Wide Push-ups', reps: 12 },
      { name: 'Alternating Bird-Dogs', reps: 16 },
    ],
    tacticalNote:
      'A heavy chest press followed by slow, deliberate posterior anti-rotation.',
  },
  {
    id: 'posterior-strike',
    name: 'Posterior Strike',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Sphinx Push-ups', reps: 10 },
      { name: 'Glute Bridge Walkouts', reps: 10 },
    ],
    tacticalNote:
      'Walk the heels out away from the hips on the bridges to torch the hamstrings.',
  },
  {
    id: 'anterior-retreat',
    name: 'Anterior Retreat',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Commando Planks', reps: 12 },
      { name: 'Superman Pull-downs', reps: 15 },
    ],
    tacticalNote:
      'On the supermans, pull the elbows down to the ribs as if pulling a heavy lat bar.',
  },
  {
    id: 'the-tug-of-war',
    name: 'The Tug-of-War',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 8 },
      { name: 'Strict Reverse Lunges', reps: 16 },
    ],
    tacticalNote:
      'Explosive anterior chain movement followed by strict, controlled posterior deceleration.',
  },
  {
    id: 'symmetry',
    name: 'Symmetry',
    durationMinutes: 10,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Plank Reaches (Total)', reps: 20 },
    ],
    tacticalNote:
      'Reach the arms straight forward during the plank to engage the lats and upper back.',
  },
  {
    id: 'the-trinity',
    name: 'The Trinity',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Air Squats', reps: 20 },
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'V-Ups', reps: 15 },
    ],
    tacticalNote:
      'The gold standard. Distributes the load evenly across all three regions.',
  },
  {
    id: 'the-fulcrum-systemic-shift',
    name: 'The Fulcrum',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Reverse Lunges (Total)', reps: 24 },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Russian Twists', reps: 20 },
    ],
    tacticalNote:
      'Heavy shoulder isolation followed immediately by rotational core control.',
  },
  {
    id: 'global-warning',
    name: 'Global Warning',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Jump Squats', reps: 15 },
      { name: 'Commando Planks', reps: 12 },
      { name: 'Dead Bugs', reps: 16 },
    ],
    tacticalNote:
      'The dead bugs require immense concentration after the plyometric leg demand.',
  },
  {
    id: 'the-apex',
    name: 'The Apex',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Glute Bridges', reps: 20 },
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Butterfly Sit-ups', reps: 20 },
    ],
    tacticalNote:
      'A massive demand on the posterior chain transitioning directly into anterior flexion.',
  },
  {
    id: 'the-axis',
    name: 'The Axis',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Surrenders', reps: 16 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Plank Jacks', reps: 20 },
    ],
    tacticalNote:
      'Keep the chest proud on the surrenders to save your lower back for the plank jacks.',
  },
  {
    id: 'the-triad',
    name: 'The Triad',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Wide Push-ups', reps: 12 },
      { name: 'Single-Leg Glute Bridges', reps: 20 },
      { name: 'Leg Raises', reps: 15 },
    ],
    tacticalNote:
      'Pectoral isolation, unilateral glute isolation, and strict lower abdominal bracing.',
  },
  {
    id: 'perimeter-defense',
    name: 'Perimeter Defense',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Skater Jumps (Total)', reps: 20 },
      { name: 'Sphinx Push-ups', reps: 10 },
      { name: 'Plank Shoulder Taps', reps: 16 },
    ],
    tacticalNote:
      'Lateral power shifting instantly into heavy triceps and anti-rotational stability.',
  },
  {
    id: 'base-camp',
    name: 'Base Camp',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Fast Air Squats', reps: 15 },
      { name: 'Standard Push-ups', reps: 10 },
      { name: 'Strict Sit-ups', reps: 15 },
    ],
    tacticalNote:
      'A classic mechanical grinder. Do not use momentum to swing up on the sit-ups.',
  },
  {
    id: 'the-equalizer',
    name: 'The Equalizer',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Down-Ups', reps: 10 },
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'Plank Knee-to-Elbows', reps: 16 },
    ],
    tacticalNote:
      'Getting off the floor is the tax here. Use the lunges to steady your breathing.',
  },
  {
    id: 'the-spire',
    name: 'The Spire',
    durationMinutes: 15,
    category: 'localized-trap',
    intensityTier: 3,
    movements: [
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'Fast Calf Raises', reps: 20 },
      { name: 'Bicycle Crunches', reps: 20 },
    ],
    tacticalNote:
      'Protects the heavy quad/hamstring musculature but aggressively torches the extremities.',
  },
  {
    id: 'the-gas-pedal',
    name: 'The Gas Pedal',
    durationMinutes: 5,
    category: 'engine-room',
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 5 },
      { name: 'Mountain Climbers', reps: 10 },
      { name: 'Jumping Jacks', reps: 15 },
    ],
    tacticalNote:
      'A cascading rep scheme that flows beautifully. Use the 15 jacks as your active recovery.',
  },
  {
    id: 'the-locomotive',
    name: 'The Locomotive',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Down-Ups', reps: 10 },
      { name: 'Air Squats', reps: 20 },
    ],
    tacticalNote:
      'Find a breathing rhythm on the squats to recover from the floor transitions.',
  },
  {
    id: 'steady-state',
    name: 'Steady State',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Sprawls', reps: 12 },
      { name: 'Mountain Climbers', reps: 24 },
    ],
    tacticalNote:
      'Keep the hips low. Lock the plank instantly when kicking back.',
  },
  {
    id: 'the-pacing-trap',
    name: 'The Pacing Trap',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 8 },
      { name: 'Alternating Lunges', reps: 16 },
    ],
    tacticalNote:
      'Lunges must be strict. Do not bounce the trailing knee off the floor.',
  },
  {
    id: 'aerobic-flush',
    name: 'Aerobic Flush',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Air Squats', reps: 15 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'A pure cardiovascular flush. Move continuously without breaking.',
  },
  {
    id: 'the-treadmill',
    name: 'The Treadmill',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Half-Burpees', reps: 10 },
      { name: 'Skater Jumps (Total)', reps: 20 },
    ],
    tacticalNote:
      'Lateral bounding paired with horizontal piston action. Keep the chest proud.',
  },
  {
    id: 'rhythmic-fire',
    name: 'Rhythmic Fire',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'Use the jumping jacks strictly to control your breathing before the next drop.',
  },
  {
    id: 'the-long-stride',
    name: 'The Long Stride',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Reverse Lunges', reps: 16 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Heavy quad demand followed by rapid hip flexion. Stay stacked over the wrists.',
  },
  {
    id: 'the-cruiser',
    name: 'The Cruiser',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 5 },
      { name: 'Air Squats', reps: 15 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'A triplet designed to keep the legs moving while distributing the fatigue.',
  },
  {
    id: 'constant-current',
    name: 'Constant Current',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Sprawls', reps: 12 },
      { name: 'Cross-Body Mountain Climbers', reps: 24 },
    ],
    tacticalNote:
      'Rotational core engagement while heavily taxing the lungs.',
  },
  {
    id: 'the-oscillator',
    name: 'The Oscillator',
    durationMinutes: 10,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Down-Ups', reps: 10 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'Explode on the knees, but pace the down-ups to avoid central nervous system burnout.',
  },
  {
    id: 'the-pacesetter',
    name: 'The Pacesetter',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Air Squats', reps: 20 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Find your breathing rhythm on the squats. Lock the plank tight on the sprawls.',
  },
  {
    id: 'steady-altitude',
    name: 'Steady Altitude',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 8 },
      { name: 'Alternating Lunges', reps: 16 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'Use the jumping jacks as active recovery to flush the legs before hitting the deck again.',
  },
  {
    id: 'the-rhythmic-grind',
    name: 'The Rhythmic Grind',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Down-Ups', reps: 10 },
      { name: 'Skater Jumps (Total)', reps: 20 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'Lateral bounding shifts the impact away from the sagittal plane, saving the knees.',
  },
  {
    id: 'aerobic-threshold',
    name: 'Aerobic Threshold',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Sprawls (Standard)', reps: 12 },
      { name: 'Air Squats', reps: 24 },
      { name: 'Lateral Line Hops', reps: 24 },
    ],
    tacticalNote:
      'A high-turnover piston. Keep the line hops incredibly low to the ground to save the calves.',
  },
  {
    id: 'the-long-stride-endurance',
    name: 'The Long Stride',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Combat Sprawls', reps: 15 },
      { name: 'Reverse Lunges', reps: 15 },
      { name: 'High Knees', reps: 30 },
    ],
    tacticalNote:
      'Combat sprawls into reverse lunges will torch the quads. Push the pace on the high knees.',
  },
  {
    id: 'the-cadence',
    name: 'The Cadence',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Half-Burpees', reps: 10 },
      { name: 'Air Squats', reps: 20 },
      { name: 'Cross-Body Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Heavy hip-hinge demand. Do not let the lower back sag during the half-burpees.',
  },
  {
    id: 'endurance-protocol',
    name: 'Endurance Protocol',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Bear Crawl to Broad Jumps', reps: 5 },
      { name: 'Air Squats', reps: 15 },
      { name: 'Double-Tap Jumps', reps: 40 },
    ],
    tacticalNote:
      'The double-taps enforce a steady rhythm. The squats act as the bridge between crawling and jumping.',
  },
  {
    id: 'the-cruiser-endurance',
    name: 'The Cruiser',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Burpees', reps: 10 },
      { name: 'Skater Jumps', reps: 20 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Constant directional changes. Breathe in through the nose, out through the mouth.',
  },
  {
    id: 'systemic-flush',
    name: 'Systemic Flush',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Jump Squats', reps: 15 },
      { name: 'Sprawls (Standard)', reps: 15 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'Only jump an inch off the floor on the squats. It is about hip extension, not vertical height.',
  },
  {
    id: 'the-engine-block',
    name: 'The Engine Block',
    durationMinutes: 15,
    category: 'engine-room',
    intensityTier: 3,
    movements: [
      { name: 'Down-Ups', reps: 12 },
      { name: 'Alternating Lunges', reps: 24 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'The ultimate test of consistency. If your round times vary by more than 10 seconds, you are failing the pace.',
  },
  {
    id: 'the-folding-knife',
    name: 'The Folding Knife',
    durationMinutes: 5,
    category: 'midline-tension',
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
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
    intensityTier: 3,
    movements: [
      { name: 'Plank Jacks', reps: 10 },
      { name: 'Superman Raises', reps: 10 },
    ],
    tacticalNote:
      'Remember the posterior core. Lift the chest and thighs off the floor simultaneously, squeezing the lower back.',
  },
  {
    id: 'the-iron-cross',
    name: 'The Iron Cross',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Plank Knee-to-Elbows', reps: 12 },
      { name: 'Air Squats', reps: 15 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'Squeeze the obliques deliberately on the plank; use the squats to recover your breath.',
  },
  {
    id: 'static-lock',
    name: 'Static Lock',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Hollow Hold', reps: 15, unit: 'sec' },
      { name: 'Reverse Lunges', reps: 10 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'The lunges force the core to act as a static brace immediately after the hollow hold.',
  },
  {
    id: 'the-vault',
    name: 'The Vault',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Commando Planks', reps: 10 },
      { name: 'Glute Bridges', reps: 15 },
      { name: 'Lateral Line Hops', reps: 20 },
    ],
    tacticalNote:
      'High tension transitioning from prone to supine. Keep the hips completely stable on the commandos.',
  },
  {
    id: 'anti-rotation',
    name: 'Anti-Rotation',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Plank Shoulder Taps', reps: 16 },
      { name: 'Jump Squats', reps: 10 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'Widen your stance on the taps to physically prevent your hips from swaying.',
  },
  {
    id: 'the-anchor',
    name: 'The Anchor',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Side Plank Dips (L)', reps: 10 },
      { name: 'Side Plank Dips (R)', reps: 10 },
      { name: 'Air Squats', reps: 20 },
    ],
    tacticalNote:
      'A pure oblique assassin. The squats act as a systemic flush before you hit the floor again.',
  },
  {
    id: 'core-suspension',
    name: 'Core Suspension',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Dead Bugs', reps: 12 },
      { name: 'Fast Air Squats', reps: 15 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Move with agonizing slowness on the dead bugs to maximize time under tension.',
  },
  {
    id: 'the-bridge',
    name: 'The Bridge',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Superman Raises', reps: 15 },
      { name: 'Down-Ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'Strengthens the posterior core heavily to counterbalance all the anterior pressing.',
  },
  {
    id: 'the-stabilizer',
    name: 'The Stabilizer',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Alternating Bird-Dogs', reps: 16 },
      { name: 'Reverse Lunges', reps: 16 },
      { name: 'Skater Jumps', reps: 20 },
    ],
    tacticalNote:
      'Pure balance and structural alignment. Do not rush the bird-dogs; reach long.',
  },
  {
    id: 'tension-grid',
    name: 'Tension Grid',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Strict Sit-ups', reps: 12 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'Rotational pressing into strict flexion, followed immediately by an upright cardio flush.',
  },
  {
    id: 'the-sling',
    name: 'The Sling',
    durationMinutes: 10,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Russian Twists', reps: 20 },
      { name: 'Sprawls', reps: 10 },
      { name: 'Double-Tap Jumps', reps: 30 },
    ],
    tacticalNote:
      'Lock the plank instantly on the sprawls so your fatigued lower back does not hyperextend.',
  },
  {
    id: 'the-monolith',
    name: 'The Monolith',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Plank Hold', reps: 20, unit: 'sec' },
      { name: 'Air Squats', reps: 20 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'Squeeze the glutes during the plank to lock the pelvis. Use the squats to flush the tension.',
  },
  {
    id: 'iron-spine',
    name: 'Iron Spine',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Alternating Bird-Dogs', reps: 16 },
      { name: 'Reverse Lunges', reps: 16 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Move with agonizing precision on the bird-dogs. Do not let the hips wobble.',
  },
  {
    id: 'static-equilibrium',
    name: 'Static Equilibrium',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Hollow Hold', reps: 20, unit: 'sec' },
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Skater Jumps', reps: 20 },
    ],
    tacticalNote:
      'The combat sprawls will spike the heart rate; the hollow hold forces you to control your panic breathing.',
  },
  {
    id: 'the-suspended-bridge',
    name: 'The Suspended Bridge',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Superman Raises', reps: 15 },
      { name: 'Glute Bridges', reps: 15 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'A masterclass in posterior chain endurance. Squeeze the erectors, glutes, and hamstrings relentlessly.',
  },
  {
    id: 'rotational-lock',
    name: 'Rotational Lock',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Plank Shoulder Taps', reps: 20 },
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'High Knees', reps: 30 },
    ],
    tacticalNote:
      'Widen your feet on the taps to physically block your hips from swaying side to side.',
  },
  {
    id: 'the-pillar',
    name: 'The Pillar',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Side Plank Dips (L)', reps: 10 },
      { name: 'Side Plank Dips (R)', reps: 10 },
      { name: 'Air Squats', reps: 20 },
    ],
    tacticalNote:
      'Total oblique isolation. Keep the chest completely open, do not roll the top shoulder toward the floor.',
  },
  {
    id: 'dead-stop',
    name: 'Dead Stop',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Dead Bugs (Slow)', reps: 20 },
      { name: 'Down-Ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'The slower you move on the dead bugs, the harder they become. Pin your ribcage to the mat.',
  },
  {
    id: 'the-brace',
    name: 'The Brace',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Plank Knee-to-Elbows', reps: 16 },
      { name: 'Reverse Lunges', reps: 16 },
      { name: 'Double-Tap Jumps', reps: 30 },
    ],
    tacticalNote:
      'The lunges force your core to act as a static brace immediately after the active flexion of the plank.',
  },
  {
    id: 'tension-span',
    name: 'Tension Span',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Strict Sit-ups', reps: 15 },
      { name: 'Superman Raises', reps: 15 },
      { name: 'Combat Sprawls', reps: 20 },
    ],
    tacticalNote:
      'Perfectly balanced anterior and posterior work. Do not throw your arms to generate momentum on the sit-ups.',
  },
  {
    id: 'the-citadel',
    name: 'The Citadel',
    durationMinutes: 15,
    category: 'midline-tension',
    intensityTier: 3,
    movements: [
      { name: 'Russian Twists', reps: 20 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Lateral Line Hops', reps: 30 },
    ],
    tacticalNote:
      'High rotational demand on both the floor and the press. Keep your eyes locked on your hands during the T-Push-ups.',
  },
  {
    id: 'the-four-horsemen',
    name: 'The Four Horsemen',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Push-ups', reps: 10 },
      { name: 'V-Ups', reps: 15 },
      { name: 'Air Squats', reps: 20 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'The baseline standard. Distributes fatigue perfectly across chest, core, legs, and lungs.',
  },
  {
    id: 'the-long-slog',
    name: 'The Long Slog',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'Walking Lunges', reps: 20 },
      { name: 'Butterfly Sit-ups', reps: 15 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Constant forward-and-back motion. Pace the hand-release push-ups from round one.',
  },
  {
    id: 'the-gridlock',
    name: 'The Gridlock',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Combat Sprawls', reps: 10 },
      { name: 'Leg Raises', reps: 15 },
      { name: 'Glute Bridges', reps: 20 },
      { name: 'High Knees', reps: 30 },
    ],
    tacticalNote:
      'Heavy on the hip flexors and core. Use the glute bridges as your active recovery.',
  },
  {
    id: 'the-horizon',
    name: 'The Horizon',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Wide Push-ups', reps: 12 },
      { name: 'Air Squats', reps: 24 },
      { name: 'Hollow Rocks', reps: 12 },
      { name: 'Lateral Line Hops', reps: 36 },
    ],
    tacticalNote:
      'A mathematical ladder. Keep the lateral line hops light and springy to rest the quads.',
  },
  {
    id: 'the-pacer',
    name: 'The Pacer',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Reverse Lunges', reps: 20 },
      { name: 'Russian Twists', reps: 15 },
      { name: 'Skater Jumps', reps: 30 },
    ],
    tacticalNote:
      'Rotational demands at every station. Breathe deeply during the T-Push-ups.',
  },
  {
    id: 'the-slow-burn',
    name: 'The Slow Burn',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Dead Bugs', reps: 15 },
      { name: 'Jump Squats', reps: 20 },
      { name: 'Butt Kicks', reps: 30 },
    ],
    tacticalNote:
      'The dead bugs force the heart rate down; the jump squats violently spike it back up.',
  },
  {
    id: 'the-ground-war',
    name: 'The Ground War',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Surrenders', reps: 10 },
      { name: 'Down-Ups', reps: 10 },
      { name: 'Strict Sit-Ups', reps: 15 },
      { name: 'Double-Tap Jumps', reps: 20 },
    ],
    tacticalNote:
      'Heavy transition tax. Getting off the floor repeatedly will slowly drain the central nervous system.',
  },
  {
    id: 'the-endurance-engine',
    name: 'The Endurance Engine',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'Plank Jacks', reps: 15 },
      { name: 'Jumping Jacks', reps: 30 },
    ],
    tacticalNote:
      'High time-under-tension on the shoulders. Shake the arms out during the lunges.',
  },
  {
    id: 'the-centurion',
    name: 'The Centurion',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'V-Ups', reps: 15 },
      { name: 'Fast Calf Raises', reps: 20 },
      { name: 'High Knees', reps: 40 },
    ],
    tacticalNote:
      'Saves the large leg muscles but destroys the calves and midline.',
  },
  {
    id: 'the-sentinel',
    name: 'The Sentinel',
    durationMinutes: 20,
    category: 'aerobic-matrix',
    intensityTier: 2,
    movements: [
      { name: 'Sprawls', reps: 10 },
      { name: 'Superman Raises', reps: 15 },
      { name: 'Air Squats', reps: 20 },
      { name: 'Mountain Climbers', reps: 30 },
    ],
    tacticalNote:
      'Attacks the posterior chain heavily. Squeeze the glutes aggressively on the Supermans.',
  },
  {
    id: 'the-baseline',
    name: 'The Baseline',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Jumping Jacks', reps: 20 },
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'Air Squats', reps: 20 },
      { name: 'V-Ups', reps: 10 },
    ],
    tacticalNote:
      'The gold standard of global distribution. Breathe easily on the jacks, brace hard on the V-Ups.',
  },
  {
    id: 'tactical-shift',
    name: 'Tactical Shift',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'High Knees', reps: 20 },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Reverse Lunges', reps: 20 },
      { name: 'Plank Shoulder Taps', reps: 10 },
    ],
    tacticalNote:
      'Vertical engine, vertical press, heavy leg tension, and rigid anti-rotation.',
  },
  {
    id: 'the-vanguard',
    name: 'The Vanguard',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Combat Sprawls', reps: 15 },
      { name: 'Glute Bridges', reps: 15 },
      { name: 'Skater Jumps', reps: 20 },
      { name: 'Dead Bugs', reps: 10 },
    ],
    tacticalNote:
      'A heavy tax on the posterior chain. Use the skater jumps to flush the lactic acid from the glutes.',
  },
  {
    id: 'overwatch',
    name: 'Overwatch',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Mountain Climbers', reps: 20 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Jump Squats', reps: 15 },
      { name: 'Strict Sit-ups', reps: 10 },
    ],
    tacticalNote:
      'Rotational pressing and explosive legs, sandwiched by core work. Pace the jump squats.',
  },
  {
    id: 'the-perimeter',
    name: 'The Perimeter',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Lateral Line Hops', reps: 20 },
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'Commando Planks', reps: 10 },
    ],
    tacticalNote:
      'Moving side-to-side, swooping low, striding forward, and pressing up. Total 3D movement.',
  },
  {
    id: 'shockwave',
    name: 'Shockwave',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Down-Ups', reps: 15 },
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'Fast Calf Raises', reps: 15 },
      { name: 'Butterfly Sit-ups', reps: 15 },
    ],
    tacticalNote:
      'Triceps and calves are heavily isolated here, but the 15-rep cap prevents total burnout.',
  },
  {
    id: 'the-sentinel-cascade',
    name: 'The Sentinel',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Butt Kicks', reps: 20 },
      { name: 'Sphinx Push-ups', reps: 10 },
      { name: 'Single-Leg Glute Bridges (Total)', reps: 20 },
      { name: 'Russian Twists', reps: 10 },
    ],
    tacticalNote:
      'Heavy triceps and hamstring focus. The butt kicks keep the engine running while standing.',
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Cross-Body Climbers', reps: 20 },
      { name: 'Standard Push-ups', reps: 10 },
      { name: 'Bodyweight Good Mornings', reps: 15 },
      { name: 'Double-Tap Jumps', reps: 20 },
    ],
    tacticalNote:
      'Huge demand on the midline and hamstrings. Keep the back perfectly flat on the good mornings.',
  },
  {
    id: 'the-piston-cascade',
    name: 'The Piston',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Half-Burpees', reps: 15 },
      { name: 'Wide Push-ups', reps: 10 },
      { name: 'Air Squats', reps: 20 },
      { name: 'Alternating Bird-Dogs', reps: 10 },
    ],
    tacticalNote:
      'Unrelenting quad and chest pressure. The bird-dogs at the end are a necessary spinal reset.',
  },
  {
    id: 'atmosphere',
    name: 'Atmosphere',
    durationMinutes: 20,
    category: 'four-point-cascade',
    intensityTier: 4,
    movements: [
      { name: 'Skater Jumps', reps: 20 },
      { name: 'Superman Raises', reps: 15 },
      { name: 'Combat Sprawls', reps: 15 },
      { name: 'Plank Knee-to-Elbows', reps: 10 },
    ],
    tacticalNote:
      'The heart rate will spike violently on the sprawls and jumps; control your breathing on the floor.',
  },
  {
    id: 'the-phalanx',
    name: 'The Phalanx',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'Bottom Squat Hold', reps: 20, unit: 'sec' },
      { name: 'Hand-Release Push-ups', reps: 10 },
      { name: 'Strict Sit-ups', reps: 15 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'Pry the floor apart during the squat hold. Do not rest on your knee joints; keep the quads violently engaged.',
  },
  {
    id: 'iron-will',
    name: 'Iron Will',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 5,
    movements: [
      { name: 'Hollow Hold', reps: 20, unit: 'sec' },
      { name: 'Combat Sprawls', reps: 15 },
      { name: 'T-Push-ups', reps: 10 },
      { name: 'Skater Jumps', reps: 20 },
    ],
    tacticalNote:
      'The hollow hold pre-exhausts the core, making the combat sprawls feel twice as heavy.',
  },
  {
    id: 'the-garrison',
    name: 'The Garrison',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'High Plank Hold', reps: 20, unit: 'sec' },
      { name: 'Alternating Lunges', reps: 20 },
      { name: 'V-Ups', reps: 15 },
      { name: 'High Knees', reps: 20 },
    ],
    tacticalNote:
      'Actively push the floor away during the plank to protract the shoulder blades.',
  },
  {
    id: 'the-stronghold',
    name: 'The Stronghold',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'Glute Bridge Hold', reps: 20, unit: 'sec' },
      { name: 'Pike Push-ups', reps: 10 },
      { name: 'Down-Ups', reps: 15 },
      { name: 'Lateral Line Hops', reps: 20 },
    ],
    tacticalNote:
      'Squeeze the glutes at absolute maximum tension during the hold to protect the lower back on the down-ups.',
  },
  {
    id: 'the-barricade',
    name: 'The Barricade',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'Side Plank Hold (Switch sides each round)', reps: 20, unit: 'sec' },
      { name: 'Air Squats', reps: 15 },
      { name: 'Dive-Bomber Push-ups', reps: 10 },
      { name: 'Mountain Climbers', reps: 20 },
    ],
    tacticalNote:
      'Pure anti-rotation followed immediately by heavy sagittal plane movement.',
  },
  {
    id: 'the-fortress',
    name: 'The Fortress',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'Superman Hold', reps: 20, unit: 'sec' },
      { name: 'Commando Planks', reps: 10 },
      { name: 'Reverse Lunges', reps: 20 },
      { name: 'Butt Kicks', reps: 20 },
    ],
    tacticalNote:
      'The Superman hold locks the posterior chain, providing a rigid foundation for the heavy lunges that follow.',
  },
  {
    id: 'the-trench',
    name: 'The Trench',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 5,
    movements: [
      { name: 'Bear Crawl Hover', reps: 20, unit: 'sec' },
      { name: 'Wide Push-ups', reps: 10 },
      { name: 'Jump Squats', reps: 15 },
      { name: 'Double-Tap Jumps', reps: 20 },
    ],
    tacticalNote:
      'Keep the knees exactly one inch off the floor during the hover. Your quads will scream.',
  },
  {
    id: 'the-bastion',
    name: 'The Bastion',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'V-Sit Hold', reps: 20, unit: 'sec' },
      { name: 'Glute Bridges', reps: 15 },
      { name: 'Sphinx Push-ups', reps: 10 },
      { name: 'Cross-Body Climbers', reps: 20 },
    ],
    tacticalNote:
      'Balance strictly on the sit bones. The cross-body climbers flush the midline after the heavy isometric hold.',
  },
  {
    id: 'the-shield',
    name: 'The Shield',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 5,
    movements: [
      { name: 'Hollow Hold', reps: 20, unit: 'sec' },
      { name: 'Diamond Push-ups', reps: 10 },
      { name: 'Fast Calf Raises', reps: 20 },
      { name: 'Combat Sprawls', reps: 15 },
    ],
    tacticalNote:
      'Core tension immediately followed by tricep isolation. The combat sprawls drive the aerobic response.',
  },
  {
    id: 'the-wall',
    name: 'The Wall',
    durationMinutes: 20,
    category: 'armor-protocol',
    intensityTier: 4,
    movements: [
      { name: 'Bottom Squat Hold', reps: 20, unit: 'sec' },
      { name: 'Dead Bugs', reps: 15 },
      { name: 'Standard Push-ups', reps: 10 },
      { name: 'Jumping Jacks', reps: 20 },
    ],
    tacticalNote:
      'The bottom hold taxes the quads before slow dead bugs reset the spine. Stay rigid through the push-ups so the jacks do not collapse your posture.',
  },
];
