export interface ExercisePhoto {
  /** Relative path in the `exercise-media` Storage bucket (e.g. "burpees/1-setup.jpg"). Empty = placeholder cell. */
  url: string;
  /** Optional label for what the photo shows; omit when not needed. */
  caption?: string;
}

export interface ExerciseInfo {
  id: string;
  name: string;
  setupAndExecution: string[];
  commonMistakes: string[];
  coachingCue: string;
  amrapTip?: string;
  photos: ExercisePhoto[];
  /** Relative path in the `exercise-media` bucket (e.g. "burpees/video.mp4"). Absent = "No video yet". */
  videoUrl?: string;
}

function findByNormalizedName(normalized: string): ExerciseInfo | undefined {
  return EXERCISE_LIBRARY.find((entry) => entry.name.toLowerCase() === normalized);
}

/** Strips a single trailing " (...)" display suffix used in workout templates. */
function stripTrailingParenthetical(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function getExerciseInfo(name: string): ExerciseInfo | undefined {
  const normalized = name.trim().toLowerCase();
  const exact = findByNormalizedName(normalized);
  if (exact) {
    return exact;
  }

  const withoutParenthetical = stripTrailingParenthetical(name).toLowerCase();
  if (withoutParenthetical !== normalized) {
    return findByNormalizedName(withoutParenthetical);
  }

  return undefined;
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
  {
    id: 'air-squat',
    name: 'Air Squats',
    setupAndExecution: [
      'Stance is shoulder-width. Hips descend back and down until the hip crease is below the top of the knee. Stand completely tall, locking out the hips and knees at the top.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Tear the floor apart with your feet." This externally rotates the femur, activating the glutes and preventing the knees from caving in.',
    amrapTip:
      'Let gravity do the work on the way down. Pull yourself into the bottom quickly, then explode up. Use your arms for rhythm.',
    photos: [],
  },
  {
    id: 'alternating-lunges',
    name: 'Alternating Lunges',
    setupAndExecution: [
      'Step backward or forward. The trailing knee must gently kiss the floor. The front shin remains relatively vertical. Push back to a full standing position with feet together.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Ride the elevator, not the escalator." Drop straight down. Do not shift your bodyweight aggressively forward over your toes.',
    amrapTip:
      'Reverse lunges are superior for AMRAPs. They protect the deceleration forces on the knee and allow for a faster, springier return to the standing position.',
    photos: [],
  },
  {
    id: 'surrenders',
    name: 'Surrenders',
    setupAndExecution: [
      'Start standing with hands behind your head. Step down to the right knee, then the left knee. Step up with the right foot, then the left foot. Stand tall.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Keep a proud chest." The moment you fold forward at the waist, you transfer the load from your quads to your lower back.',
    amrapTip:
      "Alternate your lead leg every round, not every rep, so you don't have to waste mental energy remembering which leg goes first.",
    photos: [],
  },
  {
    id: 'glute-bridges',
    name: 'Glute Bridges',
    setupAndExecution: [
      'Lie on your back, knees bent, feet flat on the floor near your hips. Drive through your heels to bridge your hips upward until your shoulders, hips, and knees form a straight line.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Pinch a coin between your glutes at the top." If you just thrust your hips recklessly, you will hyper-extend your lumbar spine.',
    amrapTip:
      'Keep your toes slightly elevated off the floor to force the drive exclusively through your heels and hamstrings.',
    photos: [],
  },
  {
    id: 'standard-push-ups',
    name: 'Standard Push-ups',
    setupAndExecution: [
      'Start in a high plank. Lower your body until your chest physically touches the floor. Press back up to full elbow extension. The body moves as a single, rigid plank.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Screw your hands into the floor." Point your index fingers straight ahead and twist outward to create torque in the shoulder capsule.',
    amrapTip:
      'Breathe in on the descent, aggressively exhale on the press. Do not hold your breath, or your heart rate will redline instantly.',
    photos: [],
  },
  {
    id: 'wide-grip-push-ups',
    name: 'Wide-Grip Push-ups',
    setupAndExecution: [
      'Same as the standard push-up, with hands placed outside shoulder width. Lower your body until your chest touches the floor and press back to full elbow extension, moving as a single rigid plank.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Screw your hands into the floor." Point your index fingers straight ahead and twist outward to create torque in the shoulder capsule.',
    amrapTip:
      'Breathe in on the descent, aggressively exhale on the press. Do not hold your breath, or your heart rate will redline instantly.',
    photos: [],
  },
  {
    id: 'hand-release-push-ups',
    name: 'Hand-Release Push-ups',
    setupAndExecution: [
      'Lower into a standard push-up. At the bottom, when the chest is on the floor, briefly lift both hands off the ground. Place them back and press up.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Squeeze the shoulder blades together." Lifting the hands isn\'t a rest; it\'s an active contraction of the upper back.',
    amrapTip:
      'This enforces a dead-stop and prevents cheating the depth. Use this variation to humble users who claim they can do 50 push-ups unbroken.',
    photos: [],
  },
  {
    id: 'diamond-push-ups',
    name: 'Diamond Push-ups',
    setupAndExecution: [
      'Hands form a diamond shape directly under the sternum. Keep elbows tucked tight to the ribcage as you lower the chest to the hands.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Shave your ribs with your elbows." If your elbows flare out on a diamond push-up, you will destroy your rotator cuff.',
    amrapTip: 'Muscular failure happens suddenly here. Break your sets earlier than you think you need to.',
    photos: [],
  },
  {
    id: 'pike-push-ups',
    name: 'Pike Push-ups',
    setupAndExecution: [
      'Start in a downward dog position (hips high, body forming an inverted V). Lower the crown of your head to the floor slightly in front of your hands, forming a tripod. Press back to the inverted V.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Look at your toes, not the floor." Tucking the chin keeps the cervical spine neutral and targets the deltoids correctly.',
    amrapTip:
      'Keep your legs straight. If your hamstrings are tight, widen your foot stance to maintain the high hip position.',
    photos: [],
  },
  {
    id: 'dive-bomber-push-ups',
    name: 'Dive-Bomber Push-ups',
    setupAndExecution: [
      'Start in a downward dog. Swoop the chest down just above the floor, passing through your hands, and finish with the chest proud and hips near the floor (upward dog). Reverse the exact same swoop backward.',
    ],
    commonMistakes: [],
    coachingCue: '"Slide under the barbed wire, then back out." It is a two-way fluid motion.',
    amrapTip:
      'This is a slow, tension-heavy movement. Focus on continuous, unbroken motion rather than speed.',
    photos: [],
  },
  {
    id: 't-push-ups',
    name: 'T-Push-ups',
    setupAndExecution: [
      'Perform a standard push-up. At the top, lift one hand off the floor, rotate your torso, and reach that hand toward the ceiling, forming a "T" shape. Return to the plank and repeat on the other side.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Eyes follow the hand." Tracking your reaching hand with your eyes ensures your thoracic spine rotates fully.',
    amrapTip:
      'Widen your foot stance slightly to provide a more stable base during the rotational phase.',
    photos: [],
  },
  {
    id: 'plank-shoulder-taps',
    name: 'Plank Shoulder Taps',
    setupAndExecution: [
      'From a high plank, tap your left shoulder with your right hand, then alternate.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Balance a glass of water on your lower back." Your hips should not rock side-to-side.',
    amrapTip:
      'Widen your feet. A wider base of support kills the rotation in the hips, making the core work harder but the movement faster.',
    photos: [],
  },
  {
    id: 'commando-planks',
    name: 'Commando Planks',
    setupAndExecution: [
      'High plank, drop to right forearm, left forearm (low plank). Press up with right hand, left hand (high plank).',
    ],
    commonMistakes: [],
    coachingCue:
      '"Balance a glass of water on your lower back." Your hips should not rock side-to-side.',
    amrapTip:
      'Widen your feet. A wider base of support kills the rotation in the hips, making the core work harder but the movement faster.',
    photos: [],
  },
  {
    id: 'plank-jacks',
    name: 'Plank Jacks',
    setupAndExecution: [
      'Hold a high or low plank. Jump both feet out wide, then jump them back together, maintaining a rigid core.',
    ],
    commonMistakes: [],
    coachingCue: '"Lock the hips in space." Do not let the hips bounce up and down with the jumps.',
    amrapTip:
      'Keep the jumps small and fast. A massive lateral jump slows down the transition and compromises the spine.',
    photos: [],
  },
  {
    id: 'jump-squats',
    name: 'Jump Squats',
    setupAndExecution: [
      'Perform a standard air squat. At the bottom, explode upward, leaving the floor. Land softly and immediately descend into the next rep.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Land like a ninja." Absorb the impact by landing on the mid-foot and instantly bending the knees. Never land with locked joints.',
    amrapTip:
      "You only need an inch of air to make it plyometric. Don't waste energy jumping for the ceiling.",
    photos: [],
  },
  {
    id: 'jumping-lunges',
    name: 'Jumping Lunges',
    setupAndExecution: [
      'Start in the bottom of a lunge. Explode upward, switch legs in the air, and land softly in a lunge on the opposite side.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Vertical force, not horizontal." Drive straight up. If you travel forward, you lose balance and waste time.',
    amrapTip:
      'Use your arms as a counterweight. Pumping the opposite arm forward provides stability and upward momentum.',
    photos: [],
  },
  {
    id: 'skater-jumps',
    name: 'Skater Jumps',
    setupAndExecution: [
      'Bound laterally off the right foot, landing softly on the left foot while sweeping the right leg behind you. Explode back to the right.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Load the hip, explode off the edge." Think of a speed skater pushing off the ice.',
    amrapTip: 'Keep the chest up. Looking down at the floor rounds the back and cuts off your airway.',
    photos: [],
  },
  {
    id: 'tuck-jumps',
    name: 'Tuck Jumps',
    setupAndExecution: [
      'From a standing position, jump powerfully straight up and pull both knees violently toward your chest. Land softly and repeat.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Bring the knees to the chest, not the chest to the knees." Do not fold forward in the air.',
    amrapTip:
      'This is incredibly demanding neurologically. Do these in small, unbroken bursts (e.g., 5 reps) and take a two-second reset.',
    photos: [],
  },
  {
    id: 'broad-jumps',
    name: 'Broad Jumps',
    setupAndExecution: [
      'Stand with feet shoulder-width. Hinge at the hips, throw the arms forward, and jump horizontally as far as possible. Land in a partial squat.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Extend the hips fully in the air." The power comes from the glutes firing, not just the quads.',
    amrapTip:
      'For an AMRAP, do not aim for maximum distance on every jump. Aim for a consistent, sustainable 4-5 foot bound that allows for rapid turnarounds.',
    photos: [],
  },
];
