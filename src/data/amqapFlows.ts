import type { TimeDomain, WorkoutTemplate, WorkoutTemplateMovement } from '@/data/workoutTemplates';

export const AMQAP_TIME_DOMAINS = [10, 15] as const satisfies readonly TimeDomain[];

export type AmqapTimeDomain = (typeof AMQAP_TIME_DOMAINS)[number];

export type AmqapFlowId = 'foundational' | 'hip-control' | 'spinal' | 'posterior' | 'deep-hip';

export interface AmqapFlowCategory {
  id: AmqapFlowId;
  label: string;
  description: string;
}

export type AmqapFlow = WorkoutTemplate & {
  flowId: AmqapFlowId;
};

export const AMQAP_FLOW_CATEGORIES: AmqapFlowCategory[] = [
  {
    id: 'foundational',
    label: 'Foundational',
    description:
      'Hips, thoracic spine, and a full sagittal sweep — the baseline sequence for a 10- or 15-minute quality flow.',
  },
  {
    id: 'hip-control',
    label: 'Hip control',
    description:
      'Active hip circles into a low lunge and a one-sided opener. Builds usable rotation, not a bounced stretch.',
  },
  {
    id: 'spinal',
    label: 'Spinal articulation',
    description:
      'Internal rotation, a gentle backbend, then Child’s Pose. Down-regulate and keep the spine moving slowly.',
  },
  {
    id: 'posterior',
    label: 'Posterior chain',
    description:
      'Cat-cow into Downward-Facing Dog, a low lunge, and Camel. Open the back line and the chest without rushing.',
  },
  {
    id: 'deep-hip',
    label: 'Deep hip',
    description:
      'Dog, Pigeon, a 90/90 lift, then Cobra. Deep capsule work with an active reset between sides.',
  },
];

const SHARED_NOTE =
  'Move slowly. The counts are one quality pass, not a score to beat. Stay in continuous tension and breathe.';

function perSide(name: string, each: number): WorkoutTemplateMovement {
  return { name: `${name} (${each}/side)`, reps: each * 2 };
}

function holdSeconds(name: string, seconds: number): WorkoutTemplateMovement {
  return { name, reps: seconds, unit: 'sec' };
}

function holdSecondsPerSide(name: string, seconds: number): WorkoutTemplateMovement {
  return { name: `${name} (${seconds}-Sec/side)`, reps: seconds * 2, unit: 'sec' };
}

function reps(name: string, count: number): WorkoutTemplateMovement {
  return { name, reps: count };
}

function flowPair(
  flowId: AmqapFlowId,
  name: string,
  focus: string,
  movements: WorkoutTemplateMovement[]
): AmqapFlow[] {
  return AMQAP_TIME_DOMAINS.map((durationMinutes) => ({
    id: `amqap-${flowId}-${durationMinutes}`,
    flowId,
    name,
    focus,
    durationMinutes,
    category: null,
    intensityTier: 1,
    movements,
    tacticalNote: SHARED_NOTE,
  }));
}

// Quality-round doses: enough slow cycles for synovial pump and both sides,
// not enough to invite a race. Same pass at 10 and 15 — the clock is the container.
export const AMQAP_FLOWS: AmqapFlow[] = [
  ...flowPair('foundational', 'Foundational Continuous Flow', 'Hips · spine · breath', [
    perSide('90/90 Hip Transitions', 5),
    perSide('Spiderman Lunge with Thoracic Reach', 5),
    reps('Downward-Facing Dog to Cobra', 5),
  ]),
  ...flowPair('hip-control', 'Hip Control and Sagittal Opening', 'Hip control', [
    perSide('Quadruped Hip Circles', 5),
    perSide('Low Lunge', 5),
    holdSecondsPerSide('Half Moon Pose', 15),
  ]),
  ...flowPair('spinal', 'Spinal Articulation and Internal Rotation', 'Spine · recover', [
    reps('Prone Internal Rotation Windshield Wipers', 10),
    reps('Cobra Pose', 5),
    holdSeconds("Child's Pose", 20),
  ]),
  ...flowPair('posterior', 'Posterior Chain and Heart Opener', 'Back line · chest', [
    reps('Cat & Cow', 8),
    holdSeconds('Downward-Facing Dog', 20),
    perSide('Low Lunge', 5),
    holdSeconds('Camel Pose', 20),
  ]),
  ...flowPair('deep-hip', 'Deep Hip and Total Body Integration', 'Capsule · integration', [
    holdSeconds('Downward-Facing Dog', 20),
    holdSecondsPerSide('Pigeon Pose', 20),
    perSide('90/90 Hip Internal Rotation Lift', 5),
    reps('Cobra Pose', 5),
  ]),
];

export function isAmqapTimeDomain(value: number): value is AmqapTimeDomain {
  return (AMQAP_TIME_DOMAINS as readonly number[]).includes(value);
}

export const AMQAP_DOMAIN_GUIDANCE: Record<AmqapTimeDomain, { title: string; body: string }> = {
  10: {
    title: '10 min quality flow',
    body: 'Long enough to warm the fascia and start the synovial pump without turning mobility into a grind. Stay slow; the clock is a container, not a race.',
  },
  15: {
    title: '15 min quality flow',
    body: 'The window this protocol is built around. Tissue warms, range compounds, and the nervous system has time to shift out of fight-or-flight. Keep the tempo quiet.',
  },
};
