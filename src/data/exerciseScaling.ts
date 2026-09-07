/**
 * Scaling ladders: the named ways an athlete can perform a programmed movement
 * when the standard version is out of reach today.
 *
 * These are not library exercises. A knee push-up has no page, no photo set and
 * nothing to say that the push-up page does not already say better — it is a
 * way of doing that movement, not a different movement. Keeping them
 * lightweight is what makes it possible to have one for everything that needs
 * one.
 *
 * **Option ids are frozen.** They are stored against results, so an id that
 * changes meaning silently rewrites an athlete's history — the same rule as the
 * benchmark ids in `campaignBenchmarks.ts`. Add a new option rather than
 * repurposing an old one; `exerciseScaling.test.ts` pins the current set.
 *
 * Options are ordered nearest-to-standard first, so the list reads as a ladder
 * an athlete climbs down only as far as they need to.
 */

export interface ScalingOption {
  /** Frozen. Stored against results. */
  id: string;
  /** What the athlete picks. */
  label: string;
  /** One line on how to do it, so the choice does not need a separate lookup. */
  how: string;
}

export interface ScalingLadder {
  /** The library exercise this scales. */
  exerciseId: string;
  options: ScalingOption[];
}

const PUSH_UP_LADDER: ScalingOption[] = [
  {
    id: 'push-up--incline',
    label: 'Hands elevated',
    how: 'Hands on a bench, chair or step. The higher the surface, the easier the rep.',
  },
  {
    id: 'push-up--knees',
    label: 'From the knees',
    how: 'Knees down, hips in line with the shoulders — do not let the hips pike up.',
  },
  {
    id: 'push-up--partial',
    label: 'Partial range',
    how: 'Lower as far as you can control and press back. Depth grows as you do.',
  },
];

const PLYO_LADDER: ScalingOption[] = [
  {
    id: 'plyo--step',
    label: 'Step instead of jump',
    how: 'Same pattern, same range, no flight. Keeps the pace without the landing.',
  },
  {
    id: 'plyo--low',
    label: 'Lower and slower',
    how: 'Keep the jump but cut the height and take the landing softly.',
  },
];

const LUNGE_LADDER: ScalingOption[] = [
  {
    id: 'lunge--supported',
    label: 'Hold a support',
    how: 'One hand on a wall or chair for balance. The legs still do the work.',
  },
  {
    id: 'lunge--partial',
    label: 'Shorter range',
    how: 'Drop only as far as you can stand back up from without pushing off your hands.',
  },
];

const CORE_LADDER: ScalingOption[] = [
  {
    id: 'core--bent-knees',
    label: 'Knees bent',
    how: 'Bend the knees to shorten the lever. The shorter it is, the lighter it is.',
  },
  {
    id: 'core--partial',
    label: 'Partial range',
    how: 'Move only through the range where you can keep the lower back on the floor.',
  },
];

const PLANK_LADDER: ScalingOption[] = [
  {
    id: 'plank--knees',
    label: 'From the knees',
    how: 'Knees down, straight line from knees to shoulders.',
  },
  {
    id: 'plank--incline',
    label: 'Hands elevated',
    how: 'Hands on a bench or step. The higher the surface, the less you carry.',
  },
];

const BURPEE_LADDER: ScalingOption[] = [
  {
    id: 'burpee--step',
    label: 'Step the feet',
    how: 'Step back and step in instead of jumping. Same shape, no impact.',
  },
  {
    id: 'burpee--incline',
    label: 'Hands elevated',
    how: 'Hands on a bench or step so the floor never comes all the way up to you.',
  },
  {
    id: 'burpee--no-jump',
    label: 'No jump at the top',
    how: 'Stand tall and reach instead of leaving the floor.',
  },
];

const SQUAT_LADDER: ScalingOption[] = [
  {
    id: 'squat--box',
    label: 'To a seat',
    how: 'Squat to a chair or box and stand back up. Lower the seat as you improve.',
  },
  {
    id: 'squat--supported',
    label: 'Hold a support',
    how: 'Hands on a doorframe or chair back to sit deeper than balance allows alone.',
  },
  {
    id: 'squat--partial',
    label: 'Shorter range',
    how: 'Go only as deep as you can control, and stop before the heels lift.',
  },
];

const CARDIO_LADDER: ScalingOption[] = [
  {
    id: 'cardio--low-impact',
    label: 'Low impact',
    how: 'Keep one foot down throughout — march the pattern instead of running it.',
  },
  {
    id: 'cardio--slower',
    label: 'Slower cadence',
    how: 'Same movement, fewer beats per minute. Cadence is the dial, not the shape.',
  },
];

const HINGE_LADDER: ScalingOption[] = [
  {
    id: 'hinge--partial',
    label: 'Shorter range',
    how: 'Lift only as high as you can hold the position without arching the back.',
  },
  {
    id: 'hinge--both-legs',
    label: 'Both legs',
    how: 'Drive through both feet instead of one.',
  },
];

const DIP_LADDER: ScalingOption[] = [
  {
    id: 'dip--feet-close',
    label: 'Feet closer in',
    how: 'Walk the heels toward you so the arms carry less of you.',
  },
  {
    id: 'dip--partial',
    label: 'Shorter range',
    how: 'Bend only as far as you can press back out of.',
  },
];

/**
 * One ladder per library exercise. `exerciseScaling.test.ts` requires every
 * `EXERCISE_LIBRARY` id to appear here so a new exercise cannot ship without a
 * named path; the plain "modified" mark remains available as a fallback if a
 * chosen option is later dropped from a ladder.
 */
export const EXERCISE_SCALING: ScalingLadder[] = [
  // Push-ups, in every variation the library programmes.
  { exerciseId: 'standard-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'wide-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'wide-grip-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'hand-release-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'diamond-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 't-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'dive-bomber-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'pike-push-ups', options: PUSH_UP_LADDER },
  { exerciseId: 'sphinx-push-ups', options: PUSH_UP_LADDER },

  // Squats.
  { exerciseId: 'air-squat', options: SQUAT_LADDER },
  { exerciseId: 'fast-air-squats', options: SQUAT_LADDER },
  { exerciseId: 'bottom-squat-hold', options: SQUAT_LADDER },
  { exerciseId: 'jump-squats', options: PLYO_LADDER },

  // Lunges.
  { exerciseId: 'reverse-lunges', options: LUNGE_LADDER },
  { exerciseId: 'strict-reverse-lunges', options: LUNGE_LADDER },
  { exerciseId: 'alternating-lunges', options: LUNGE_LADDER },
  { exerciseId: 'walking-lunges', options: LUNGE_LADDER },
  { exerciseId: 'jumping-lunges', options: PLYO_LADDER },
  { exerciseId: 'surrenders', options: LUNGE_LADDER },

  // Burpees and their relatives.
  { exerciseId: 'burpees', options: BURPEE_LADDER },
  { exerciseId: 'half-burpees', options: BURPEE_LADDER },
  { exerciseId: 'sprawls', options: BURPEE_LADDER },
  { exerciseId: 'combat-sprawls', options: BURPEE_LADDER },
  { exerciseId: 'down-ups', options: BURPEE_LADDER },
  { exerciseId: 'bear-crawl-to-broad-jumps', options: BURPEE_LADDER },

  // Jumping and landing.
  { exerciseId: 'skater-jumps', options: PLYO_LADDER },
  { exerciseId: 'tuck-jumps', options: PLYO_LADDER },
  { exerciseId: 'broad-jumps', options: PLYO_LADDER },
  { exerciseId: 'lateral-line-hops', options: PLYO_LADDER },
  { exerciseId: 'double-tap-jumps', options: PLYO_LADDER },
  { exerciseId: 'pogo-jumps', options: PLYO_LADDER },
  { exerciseId: 'fast-calf-raises', options: PLYO_LADDER },

  // Cardio patterns where cadence and impact are the dials.
  { exerciseId: 'jumping-jacks', options: CARDIO_LADDER },
  { exerciseId: 'high-knees', options: CARDIO_LADDER },
  { exerciseId: 'butt-kicks', options: CARDIO_LADDER },
  { exerciseId: 'mountain-climbers', options: CARDIO_LADDER },
  { exerciseId: 'cross-body-mountain-climbers', options: CARDIO_LADDER },
  { exerciseId: 'cross-body-climbers', options: CARDIO_LADDER },

  // Planks and anything held in a plank.
  { exerciseId: 'plank-hold', options: PLANK_LADDER },
  { exerciseId: 'high-plank-hold', options: PLANK_LADDER },
  { exerciseId: 'commando-planks', options: PLANK_LADDER },
  { exerciseId: 'plank-shoulder-taps', options: PLANK_LADDER },
  { exerciseId: 'plank-jacks', options: PLANK_LADDER },
  { exerciseId: 'plank-knee-to-elbows', options: PLANK_LADDER },
  { exerciseId: 'plank-reaches', options: PLANK_LADDER },
  { exerciseId: 'bear-crawl-hover', options: PLANK_LADDER },
  { exerciseId: 'side-plank-hold', options: PLANK_LADDER },
  { exerciseId: 'side-plank-dips', options: PLANK_LADDER },

  // Midline work where the lever is the load.
  { exerciseId: 'v-ups', options: CORE_LADDER },
  { exerciseId: 'strict-sit-ups', options: CORE_LADDER },
  { exerciseId: 'butterfly-sit-ups', options: CORE_LADDER },
  { exerciseId: 'leg-raises', options: CORE_LADDER },
  { exerciseId: 'hollow-hold', options: CORE_LADDER },
  { exerciseId: 'hollow-rocks', options: CORE_LADDER },
  { exerciseId: 'v-sit-hold', options: CORE_LADDER },
  { exerciseId: 'flutter-kicks', options: CORE_LADDER },
  { exerciseId: 'bicycle-crunches', options: CORE_LADDER },
  { exerciseId: 'russian-twists', options: CORE_LADDER },
  { exerciseId: 'dead-bugs', options: CORE_LADDER },

  // Posterior chain.
  { exerciseId: 'glute-bridges', options: HINGE_LADDER },
  { exerciseId: 'standard-glute-bridges', options: HINGE_LADDER },
  { exerciseId: 'single-leg-glute-bridges', options: HINGE_LADDER },
  { exerciseId: 'glute-bridge-hold', options: HINGE_LADDER },
  { exerciseId: 'glute-bridge-walkouts', options: HINGE_LADDER },
  { exerciseId: 'superman-raises', options: HINGE_LADDER },
  { exerciseId: 'superman-hold', options: HINGE_LADDER },
  { exerciseId: 'supermans', options: HINGE_LADDER },
  { exerciseId: 'superman-pull-downs', options: HINGE_LADDER },
  { exerciseId: 'reverse-snow-angels', options: HINGE_LADDER },
  { exerciseId: 'alternating-bird-dogs', options: HINGE_LADDER },
  { exerciseId: 'bodyweight-good-mornings', options: HINGE_LADDER },

  // Arms.
  { exerciseId: 'floor-dips', options: DIP_LADDER },
];
