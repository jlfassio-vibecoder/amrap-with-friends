export interface ExercisePhoto {
  /**
   * Relative path in the `exercise-media` Storage bucket.
   * Convention: `{exerciseId}/sequence.jpeg` (library default).
   * Upload either `.jpeg` or `.png` — the modal tries both on load failure.
   * Empty = placeholder cell.
   */
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

/** Default sequence still path: `{id}/sequence.jpeg` in the exercise-media bucket. */
function sequencePhotos(id: string, caption?: string): ExercisePhoto[] {
  return caption
    ? [{ url: `${id}/sequence.jpeg`, caption }]
    : [{ url: `${id}/sequence.jpeg` }];
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
      'Drop into a squat, plant hands, and jump feet back. Lower the body until the chest and thighs physically touch the floor. Press up, jump feet forward, and execute a vertical jump, clapping hands overhead.',
    ],
    commonMistakes: [
      'Sagging hips in the plank position.',
      'Skipping the full hip extension on the jump.',
    ],
    coachingCue:
      '"Drop fast, snap up faster." Do not waste energy lowering yourself into a strict push-up. Throw yourself to the deck safely and use the hips to violently snap the feet back under the body.',
    amrapTip:
      'Find a breathing cadence. Exhale on the drop, inhale on the floor, exhale on the jump. If you hold your breath on burpees, you will redline in 45 seconds.',
    photos: sequencePhotos('burpees'),
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
    photos: sequencePhotos(
      'air-squat',
      'Full squat sequence — stand, descent, ascent'
    ),
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
    photos: sequencePhotos('alternating-lunges'),
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
    photos: sequencePhotos('surrenders'),
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
    photos: sequencePhotos('glute-bridges'),
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
    photos: sequencePhotos('standard-push-ups'),
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
    photos: sequencePhotos('wide-grip-push-ups'),
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
    photos: sequencePhotos('hand-release-push-ups'),
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
    photos: sequencePhotos('diamond-push-ups'),
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
    photos: sequencePhotos('pike-push-ups'),
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
    photos: sequencePhotos('dive-bomber-push-ups'),
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
    photos: sequencePhotos('t-push-ups'),
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
    photos: sequencePhotos('plank-shoulder-taps'),
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
    photos: sequencePhotos('commando-planks'),
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
    photos: sequencePhotos('plank-jacks'),
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
    photos: sequencePhotos('jump-squats'),
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
    photos: sequencePhotos('jumping-lunges'),
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
    photos: sequencePhotos('skater-jumps'),
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
    photos: sequencePhotos('tuck-jumps'),
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
    photos: sequencePhotos('broad-jumps'),
  },
  {
    id: 'bottom-squat-hold',
    name: 'Bottom Squat Hold',
    setupAndExecution: [
      'Descend until the hip crease is below the knee. Maintain an upright torso and keep the weight evenly distributed across the full foot.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Pry the floor apart." Do not rest passively on your joints; maintain violent muscular tension in the glutes and quads.',
    amrapTip:
      'Lactic acid floods the legs rapidly here. Breathe deep into your diaphragm to delay the panic reflex.',
    photos: sequencePhotos('bottom-squat-hold'),
  },
  {
    id: 'sphinx-push-ups',
    name: 'Sphinx Push-ups',
    setupAndExecution: [
      'Begin in a forearm plank. Press both palms into the floor and extend the elbows simultaneously to rise into a high plank.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Move as one sheet of glass." If your hips sag or you press up one arm at a time, you are leaking kinetic energy.',
    amrapTip:
      'Keep your elbows tucked tight to your ribs to maximize triceps recruitment and protect the shoulder joint.',
    photos: sequencePhotos('sphinx-push-ups'),
  },
  {
    id: 'floor-dips',
    name: 'Floor Dips',
    setupAndExecution: [
      'Sit on the floor with knees bent and hands behind you, fingers facing the heels. Elevate hips slightly, bend elbows to lower, and press to lockout.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Pin your shoulder blades into your back pockets." Rolling shoulders forward transfers load to the vulnerable anterior shoulder capsule.',
    amrapTip:
      'Keep your hips planted close to your wrists to prevent shifting the workload away from the arms.',
    photos: sequencePhotos('floor-dips'),
  },
  {
    id: 'hollow-hold',
    name: 'Hollow Hold',
    setupAndExecution: [
      'Lie supine. Squeeze the legs together, lift the shoulders, and elevate the heels six inches, creating a rigid crescent moon shape.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Crush the floorboard with your lower back." If any daylight passes beneath your lumbar spine, the hold is void.',
    amrapTip:
      'Fatigue causes the back to arch. Regress the movement immediately by tucking your knees toward your chest when this happens.',
    photos: sequencePhotos('hollow-hold'),
  },
  {
    id: 'reverse-lunges',
    name: 'Reverse Lunges',
    setupAndExecution: [
      'From a standing position, step one foot directly backward. Lower your hips straight down until the trailing knee gently kisses the floor. The front shin remains vertical. Drive powerfully through the front heel to return to a standing position.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Pull yourself up with the front hamstring." Do not just push off the back toe; use the front leg to actively drag your bodyweight back to the starting position.',
    amrapTip:
      'Keep your torso completely upright. Leaning forward shifts the load to the lower back and robs the quads of the intended tension.',
    photos: sequencePhotos('reverse-lunges'),
  },
  {
    id: 'single-leg-glute-bridges',
    name: 'Single-Leg Glute Bridges',
    setupAndExecution: [
      'Lie supine with one knee bent and that foot flat on the floor. Extend the opposite leg completely straight. Drive through the planted heel to lift the hips until the shoulders, hips, and knees form a straight line. Lower with control.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Punch the ceiling with your floating heel." This keeps the extended leg active and prevents the pelvis from violently twisting under the unilateral load.',
    amrapTip:
      'Keep both thighs parallel to each other throughout the entire movement. Do not let the extended leg drift up or drop down.',
    photos: sequencePhotos('single-leg-glute-bridges'),
  },
  {
    id: 'standard-glute-bridges',
    name: 'Standard Glute Bridges',
    setupAndExecution: [
      'Lie on your back, knees bent, feet flat on the floor hip-width apart. Drive through your heels to bridge your hips upward. Hold for a micro-second at maximum extension, then lower under tension.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Crack a walnut between your glutes at the top." We are chasing maximum muscular contraction, not just mindless hip thrusting.',
    amrapTip:
      'If you begin to feel a deep ache in your lower back, your abdominals have turned off. Brace your core tightly before initiating the bridge.',
    photos: sequencePhotos('standard-glute-bridges'),
  },
  {
    id: 'wide-push-ups',
    name: 'Wide Push-ups',
    setupAndExecution: [
      'Start in a high plank with hands placed significantly wider than shoulder-width. Lower the chest to the floor, keeping the body in a rigid line, then press back to full lockout.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Try to tear the floor apart horizontally." Actively pulling your hands away from each other creates massive tension across the pectoral muscles.',
    amrapTip:
      'This angle completely isolates the chest and removes the triceps from the equation. When pectoral failure hits, it hits instantly. Break your sets into 3s or 4s before the muscle completely shuts down.',
    photos: sequencePhotos('wide-push-ups'),
  },
  {
    id: 'side-plank-dips',
    name: 'Side Plank Dips',
    setupAndExecution: [
      'Prop yourself up on one forearm, stacking your feet so your body forms a straight, diagonal line. Lower your bottom hip until it lightly taps the floor, then aggressively contract the obliques to lift the hip back up to the starting position (or slightly higher).',
    ],
    commonMistakes: [],
    coachingCue:
      '"Imagine a heavy cable pulling your top hip directly to the ceiling."',
    amrapTip:
      'Do not let the top shoulder roll forward toward the floor. Keep the chest completely open to keep the tension locked entirely on the obliques.',
    photos: sequencePhotos('side-plank-dips'),
  },
  {
    id: 'pogo-jumps',
    name: 'Pogo Jumps',
    setupAndExecution: [
      'Stand tall with feet together. Keeping the knees nearly locked (only a micro-bend), bounce rapidly off the balls of the feet. The power is generated exclusively from the ankles and calves.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Your ankles are steel springs. Punch the ground away."',
    amrapTip:
      'Minimize ground contact time. The heels should never touch the floor. The moment the ball of the foot strikes the mat, rebound instantly.',
    photos: sequencePhotos('pogo-jumps'),
  },
  {
    id: 'fast-calf-raises',
    name: 'Fast Calf Raises',
    setupAndExecution: [
      'Stand perfectly tall with feet shoulder-width. Explosively drive up onto the balls of the feet, lifting the heels as high as mechanically possible, then rapidly drop back down, stopping just millimeters before the heels touch the floor.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Spike the heels up, control the crash down." Do not just bounce mindlessly; force full plantar flexion at the top of every single rep.',
    amrapTip:
      'As the calves fill with lactic acid, your body will naturally try to shorten the range of motion. Fight for maximum height on the 20th rep just like you did on the 1st rep.',
    photos: sequencePhotos('fast-calf-raises'),
  },
  {
    id: 'sprawls',
    name: 'Sprawls',
    setupAndExecution: [
      'Plant hands on the floor and jump feet back into a rigid high plank position. Immediately jump the feet back toward the hands and stand fully upright, opening the hips completely.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Lock the plank." When you kick back, your core must act as a sudden brake to prevent the lower back from hyperextending and sagging toward the floor.',
    amrapTip:
      'Keep a wide stance. Landing with your feet outside your hands reduces the distance your hips have to travel and speeds up the transition to standing.',
    photos: sequencePhotos('sprawls'),
  },
  {
    id: 'combat-sprawls',
    name: 'Combat Sprawls',
    setupAndExecution: [
      'From a wide, low defensive crouch, plant both hands on the floor. Violently kick both feet back into a rigid high plank. Instantly pull the knees forward, jumping the feet wide to land flat-footed on the outside of your hands. Lift your hands and chest to return to the defensive crouch, never fully standing or locking out the hips.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Drop to evade, recover to defend." The hips must remain low; if you stand all the way up, you are giving your quads an unearned rest. You must live in the tension.',
    amrapTip:
      'You must land with your entire foot completely flat on the mat when returning from the plank. Landing on your toes in this wide stance places severe shearing force on the knee capsule and kills your ability to rebound.',
    photos: sequencePhotos('combat-sprawls'),
  },
  {
    id: 'down-ups',
    name: 'Down-Ups',
    setupAndExecution: [
      'Similar to the sprawl, but start standing, drop to the floor until your chest touches (like a burpee), then snap back up to a standing position without the jump and clap at the top.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Stand tall and proud." The rep is not complete until your knees and hips are locked out and your shoulders are behind your collarbone.',
    amrapTip:
      'This movement is all about hip-hinge efficiency. Minimize the time spent with your hands on the floor.',
    photos: sequencePhotos('down-ups'),
  },
  {
    id: 'half-burpees',
    name: 'Half-Burpees',
    setupAndExecution: [
      'Start in a high plank. Jump both feet forward so they land flat outside your hands in a low squat position. Immediately jump them back to the rigid high plank. You never stand up.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Stay in the tunnel." Your hips should never rise above your shoulders. It is a rapid, horizontal piston motion.',
    amrapTip:
      'Your quads will burn intensely. Keep your weight shifted slightly forward over your shoulders to give your legs a mechanical advantage.',
    photos: sequencePhotos('half-burpees'),
  },
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    setupAndExecution: [
      'Start in a high plank. Drive one knee aggressively toward the chest, then rapidly switch legs in mid-air. The hips must remain low and level.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Run on the wall." Imagine you are sprinting vertically. Do not let your hips bounce up and down like a seesaw.',
    amrapTip:
      'Keep your shoulders stacked directly over your wrists. If you drift backward, you lose leverage and the movement slows down completely.',
    photos: sequencePhotos('mountain-climbers'),
  },
  {
    id: 'cross-body-mountain-climbers',
    name: 'Cross-Body Mountain Climbers',
    setupAndExecution: [
      'From a high plank, violently drive the right knee across the body to tap the left elbow, then switch.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Wring out the towel." Force a deep rotational twist in the torso on every single rep to maximize oblique engagement.',
    amrapTip:
      'Because of the rotation, these are slightly slower than standard mountain climbers. Focus on the hard muscular contraction rather than pure foot speed.',
    photos: sequencePhotos('cross-body-mountain-climbers'),
  },
  {
    id: 'high-knees',
    name: 'High Knees',
    setupAndExecution: [
      'Run in place, driving the knees upward. The knee must break the horizontal plane of the hip crease for the rep to count. Keep the torso perfectly upright.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Punch the glass ceiling." Pump your arms in perfect synchronization with your legs to drive the upward momentum.',
    amrapTip:
      'Land lightly on the balls of your feet. If you are stomping flat-footed, you are destroying your momentum and your knees.',
    photos: sequencePhotos('high-knees'),
  },
  {
    id: 'butt-kicks',
    name: 'Butt Kicks',
    setupAndExecution: [
      'Run in place, violently pulling the heels up to physically strike the glutes. The knees point down toward the floor, not forward.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Flick the dirt off your heels." This is rapid hamstring contraction.',
    amrapTip:
      'Lean slightly forward from the ankles (not the waist) to maintain an aggressive, forward-driving posture even while stationary.',
    photos: sequencePhotos('butt-kicks'),
  },
  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    setupAndExecution: [
      'Start standing. Jump feet wide while simultaneously sweeping arms out and overhead until hands touch. Jump back to the starting position.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Long arms, rigid legs." Do not do lazy, bent-elbow jumping jacks. Force full range of motion in the shoulder capsule.',
    amrapTip:
      'Use this movement for active recovery. When paired with burpees or mountain climbers, the jumping jack is your opportunity to catch your breath.',
    photos: sequencePhotos('jumping-jacks'),
  },
  {
    id: 'lateral-line-hops',
    name: 'Lateral Line Hops',
    setupAndExecution: [
      'Pick a literal or imaginary line on the floor. Keep feet glued together and jump rapidly side-to-side over the line.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Pogo stick tension." The knees remain only slightly bent. All the power is generated from the calves and ankles.',
    amrapTip:
      'Keep your eyes up. Looking down at the line naturally rounds the shoulders and constricts the airway.',
    photos: sequencePhotos('lateral-line-hops'),
  },
  {
    id: 'double-tap-jumps',
    name: 'Double-Tap Jumps',
    setupAndExecution: [
      'Jump straight up into the air. While airborne, rapidly slap your outer thighs twice with your hands before your feet touch the ground.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Tap at the apex." The slaps must happen at the absolute highest point of the jump to enforce the correct hang-time.',
    amrapTip:
      'This perfectly simulates the neurological timing of a double-under with a jump rope. Keep the torso completely hollow and rigid in the air.',
    photos: sequencePhotos('double-tap-jumps'),
  },
  {
    id: 'v-ups',
    name: 'V-Ups',
    setupAndExecution: [
      'Lie supine, snapping straight arms and legs up simultaneously to touch toes over the midline.',
    ],
    commonMistakes: [],
    coachingCue: '"Fold like a steel trapdoor."',
    amrapTip:
      'If you bend your knees to reach your toes, you are cheating the lower abdominals.',
    photos: sequencePhotos('v-ups'),
  },
  {
    id: 'strict-sit-ups',
    name: 'Strict Sit-Ups',
    setupAndExecution: [
      'Butterfly the feet. Touch the floor behind your head, then sit up to touch your toes.',
    ],
    commonMistakes: [],
    coachingCue: '"Roll up one vertebra at a time."',
    amrapTip:
      'Do not throw your arms forward to generate momentum; force the core to pull the weight.',
    photos: sequencePhotos('strict-sit-ups'),
  },
  {
    id: 'leg-raises',
    name: 'Leg Raises',
    setupAndExecution: [
      'Lie supine, raising straight legs to a 90-degree angle, then lowering with absolute control.',
    ],
    commonMistakes: [],
    coachingCue: '"Pin the ribcage to the floor."',
    amrapTip:
      'Stop lowering your legs the exact millisecond your lower back arches off the mat.',
    photos: sequencePhotos('leg-raises'),
  },
  {
    id: 'russian-twists',
    name: 'Russian Twists',
    setupAndExecution: [
      'Balance on the sit bones with feet elevated. Violently rotate the torso to physically touch the floor on each side.',
    ],
    commonMistakes: [],
    coachingCue: '"Your eyes must track your hands."',
    amrapTip:
      'Cross your ankles to lock the lower body and isolate the rotation to the thoracic spine.',
    photos: sequencePhotos('russian-twists'),
  },
  {
    id: 'bicycle-crunches',
    name: 'Bicycle Crunches',
    setupAndExecution: [
      'Lie supine, twisting to drive the elbow to the opposite knee while fully extending the other leg.',
    ],
    commonMistakes: [],
    coachingCue: '"Rotate from the sternum, not by pulling the neck."',
    amrapTip:
      'Keep elbows pinned wide; pulling on the back of your head is a fake rep.',
    photos: sequencePhotos('bicycle-crunches'),
  },
  {
    id: 'plank-knee-to-elbows',
    name: 'Plank Knee-to-Elbows',
    setupAndExecution: [
      'From a high plank, drive the knee outside the body to physically touch the triceps.',
    ],
    commonMistakes: [],
    coachingCue: '"Crunch the obliques sideways."',
    amrapTip:
      'Keep hips completely level to avoid shifting the workload to the hip flexors.',
    photos: sequencePhotos('plank-knee-to-elbows'),
  },
  {
    id: 'dead-bugs',
    name: 'Dead Bugs',
    setupAndExecution: [
      'Supine with knees bent at 90 degrees. Slowly extend opposite arm and leg toward the floor.',
    ],
    commonMistakes: [],
    coachingCue: '"Crush a grape under your lumbar spine."',
    amrapTip:
      'Speed is your enemy here. Move deliberately to maximize time under tension.',
    photos: sequencePhotos('dead-bugs'),
  },
  {
    id: 'flutter-kicks',
    name: 'Flutter Kicks',
    setupAndExecution: [
      'Supine, legs six inches off the floor, rapidly kicking up and down.',
    ],
    commonMistakes: [],
    coachingCue: '"Point the toes, lock the quads."',
    amrapTip:
      'Tuck your chin firmly to your chest to lock down the upper abdominals and protect the neck.',
    photos: sequencePhotos('flutter-kicks'),
  },
  {
    id: 'superman-raises',
    name: 'Superman Raises',
    setupAndExecution: [
      'Prone on the floor, simultaneously lift the chest and thighs off the mat.',
    ],
    commonMistakes: [],
    coachingCue: '"Fly, do not jerk."',
    amrapTip:
      'Aggressively squeeze the glutes before lifting the chest to protect the lower back from hyperextension.',
    photos: sequencePhotos('superman-raises'),
  },
  {
    id: 'alternating-bird-dogs',
    name: 'Alternating Bird-Dogs',
    setupAndExecution: [
      'From a quadruped position (hands under shoulders, knees under hips), slowly extend the right arm forward and the left leg backward until both are parallel to the floor. Return and switch.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Balance a glass of water on your lower back." There should be zero spinal rotation.',
    amrapTip:
      'Reach long, not high. Hyperextending the back to get your leg higher defeats the core stabilization purpose entirely.',
    photos: sequencePhotos('alternating-bird-dogs'),
  },
  {
    id: 'bear-crawl-hover',
    name: 'Bear Crawl Hover',
    setupAndExecution: [
      'Set up in a quadruped position. Press your toes into the mat and lift both knees exactly one inch off the floor. Freeze.',
    ],
    commonMistakes: [],
    coachingCue: '"Your shins are parallel to the deck."',
    amrapTip:
      'As your quads burn, your hips will naturally try to pike up toward the ceiling to relieve the tension. Pin them down.',
    photos: sequencePhotos('bear-crawl-hover'),
  },
  {
    id: 'high-plank-hold',
    name: 'High Plank Hold',
    setupAndExecution: [
      'Assume the top of a push-up position. Hands directly under shoulders, legs perfectly straight, core braced.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Actively push the floor away from you." This protracts the shoulder blades and engages the serratus anterior.',
    amrapTip:
      'Squeeze your glutes. A plank is not just a shoulder exercise; it is a full-body isometric lock.',
    photos: sequencePhotos('high-plank-hold'),
  },
  {
    id: 'hollow-rocks',
    name: 'Hollow Rocks',
    setupAndExecution: [
      'Assume the hollow hold position (supine, lower back crushed into the floor, shoulders and heels elevated). Generate a tiny rocking motion head-to-toe without breaking the structural shape.',
    ],
    commonMistakes: [],
    coachingCue: '"Maintain the rigid crescent moon."',
    amrapTip:
      'The rocking motion should be miniature. If your lower back peels off the floor, you are using momentum, not your core.',
    photos: sequencePhotos('hollow-rocks'),
  },
  {
    id: 'plank-hold',
    name: 'Plank Hold',
    setupAndExecution: [
      'Rest on your forearms with elbows stacked under shoulders. Body forms a perfectly straight line from the crown of the head to the heels.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Drag your elbows toward your toes." (This is an isometric intention—they won\'t actually move, but the tension in your lats and core will double).',
    amrapTip:
      'Keep your forearms parallel. Do not interlock your fingers, which internally rotates the shoulders and compromises the posture.',
    photos: sequencePhotos('plank-hold'),
  },
  {
    id: 'plank-reaches',
    name: 'Plank Reaches',
    setupAndExecution: [
      'From a high plank, slowly reach one arm straight out in front of you until it is parallel to the floor. Place it back, then switch arms.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Do not let the hips spill." Your torso must remain perfectly square to the mat.',
    amrapTip:
      'Widen your feet slightly wider than shoulder-width to create a tripod base before you lift a hand.',
    photos: sequencePhotos('plank-reaches'),
  },
  {
    id: 'side-plank-hold',
    name: 'Side Plank Hold',
    setupAndExecution: [
      'Prop yourself on one forearm, stack your feet, and lift your hips until your body forms a straight line.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Imagine a steel cable pulling your top hip directly into the ceiling."',
    amrapTip:
      'Squeeze the bottom glute aggressively to prevent the hips from hinging backward.',
    photos: sequencePhotos('side-plank-hold'),
  },
  {
    id: 'v-sit-hold',
    name: 'V-Sit Hold',
    setupAndExecution: [
      'Balance entirely on your sit bones. Elevate straight legs to a 45-degree angle and lean your torso back slightly, reaching your arms forward parallel to the floor.',
    ],
    commonMistakes: [],
    coachingCue: '"Balance on the razor\'s edge."',
    amrapTip:
      'If your lower back rounds, the hold is broken. Pull your knees slightly toward your chest to reset the flat spine.',
    photos: sequencePhotos('v-sit-hold'),
  },
  {
    id: 'butterfly-sit-ups',
    name: 'Butterfly Sit-ups',
    setupAndExecution: [
      'Lie supine, bring the soles of your feet together, and let your knees fall open. Touch the floor behind your head, then sit all the way up and touch your toes.',
    ],
    commonMistakes: [],
    coachingCue: '"Roll up one vertebra at a time."',
    amrapTip:
      'The butterfly leg position mechanically disables the hip flexors, forcing pure abdominal contraction. Do not use your arms to swing forward.',
    photos: sequencePhotos('butterfly-sit-ups'),
  },
  {
    id: 'cross-body-climbers',
    name: 'Cross-Body Climbers',
    setupAndExecution: [
      'From a high plank, violently drive the right knee across the body under the torso to physically tap the left elbow, then switch.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Wring out the towel." Force a deep rotational twist in the torso on every rep.',
    amrapTip:
      'Focus on the hard muscular contraction and the twist rather than pure foot speed.',
    photos: sequencePhotos('cross-body-climbers'),
  },
  {
    id: 'bodyweight-good-mornings',
    name: 'Bodyweight Good Mornings',
    setupAndExecution: [
      'Stand tall, hands lightly behind your head. With a micro-bend in the knees, hinge your hips straight back until your torso is nearly parallel to the floor. Stand back up aggressively.',
    ],
    commonMistakes: [],
    coachingCue: '"Push your hips through the wall behind you."',
    amrapTip:
      'The moment your lower back starts to round, you have gone too deep. The stretch must be felt entirely in the hamstrings.',
    photos: sequencePhotos('bodyweight-good-mornings'),
  },
  {
    id: 'glute-bridge-hold',
    name: 'Glute Bridge Hold',
    setupAndExecution: [
      'Lie supine, knees bent, feet flat. Drive the hips up into full extension and freeze the position.',
    ],
    commonMistakes: [],
    coachingCue: '"Crack a walnut." Uncompromising glute tension.',
    amrapTip:
      'Drive through your heels, not your toes. Pressing through the toes shifts the load to the quads.',
    photos: sequencePhotos('glute-bridge-hold'),
  },
  {
    id: 'glute-bridge-walkouts',
    name: 'Glute Bridge Walkouts',
    setupAndExecution: [
      'Hold the top of a glute bridge. Slowly walk your heels out away from your body in small, alternating steps until your legs are nearly straight. Walk them back in.',
    ],
    commonMistakes: [],
    coachingCue: '"Dig your heels into the dirt."',
    amrapTip:
      'If you rush this, your hamstrings will instantly cramp. Move in slow, deliberate micro-steps.',
    photos: sequencePhotos('glute-bridge-walkouts'),
  },
  {
    id: 'reverse-snow-angels',
    name: 'Reverse Snow Angels',
    setupAndExecution: [
      'Lie prone (face down). Keep your chest hovering slightly off the floor. Keep your arms totally straight and sweep them from your hips all the way overhead in a wide arc.',
    ],
    commonMistakes: [],
    coachingCue: '"Scrape your knuckles across the ceiling."',
    amrapTip:
      'Do not let your hands rest on the floor during the sweep. Keep constant tension on the upper back and rear deltoids.',
    photos: sequencePhotos('reverse-snow-angels'),
  },
  {
    id: 'superman-hold',
    name: 'Superman Hold',
    setupAndExecution: [
      'Lie prone. Simultaneously lift your chest, arms, and thighs off the floor and hold the rigid, arched position.',
    ],
    commonMistakes: [],
    coachingCue: '"Fly, do not bend."',
    amrapTip:
      'Aggressively squeeze the glutes before you lift the chest to protect the lower back from absorbing all the force.',
    photos: sequencePhotos('superman-hold'),
  },
  {
    id: 'superman-pull-downs',
    name: 'Superman Pull-downs',
    setupAndExecution: [
      'Hold the top of the Superman position with arms extended forward. Pull your elbows back and down toward your ribs, squeezing the lats, then press the arms back forward.',
    ],
    commonMistakes: [],
    coachingCue: '"Pull a heavy cable down to your ribs."',
    amrapTip:
      'You must create artificial tension. If you just wave your arms in the air, you are wasting your time.',
    photos: sequencePhotos('superman-pull-downs'),
  },
  {
    id: 'supermans',
    name: 'Supermans',
    setupAndExecution: [
      'Lie prone. Simultaneously lift the chest and thighs off the mat, pause for a micro-second, then lower with control.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Controlled flight." Do not jerk the torso off the floor violently.',
    amrapTip:
      'The pause at the top of every rep is mandatory to ensure muscular contraction, not momentum.',
    photos: sequencePhotos('supermans'),
  },
  {
    id: 'bear-crawl-to-broad-jumps',
    name: 'Bear Crawl to Broad Jumps',
    setupAndExecution: [
      'Drop into a bear crawl position (hips low). Move forward four paces. Plant the feet, stand rapidly, and execute a horizontal broad jump.',
    ],
    commonMistakes: [],
    coachingCue:
      '"Stay in the tunnel during the crawl; explode out of it on the jump."',
    amrapTip:
      'Use the momentum of standing up from the crawl to instantly launch into the broad jump. Do not stutter-step.',
    photos: sequencePhotos('bear-crawl-to-broad-jumps'),
  },
  {
    id: 'fast-air-squats',
    name: 'Fast Air Squats',
    setupAndExecution: [
      'A standard bodyweight squat executed at maximum velocity. The hip crease must still break the plane of the knee, and the hips must fully lock out at the top.',
    ],
    commonMistakes: [],
    coachingCue: '"Piston action. Drop and fire."',
    amrapTip:
      'Speed often ruins depth. The moment your squats become "half-squats," your round time is invalid.',
    photos: sequencePhotos('fast-air-squats'),
  },
  {
    id: 'push-ups',
    name: 'Push-ups',
    setupAndExecution: [
      'Start in a high plank. Lower the body until the chest touches the floor, keeping elbows tracking back at a 45-degree angle. Press back to full lockout.',
    ],
    commonMistakes: [],
    coachingCue: '"Your body is a single sheet of steel."',
    amrapTip:
      'Do not let your hips sag to touch the floor before your chest does.',
    photos: sequencePhotos('push-ups'),
  },
  {
    id: 'strict-reverse-lunges',
    name: 'Strict Reverse Lunges',
    setupAndExecution: [
      'Step one foot backward and lower the hips straight down until the trailing knee gently taps the floor. The front shin remains vertical.',
    ],
    commonMistakes: [],
    coachingCue: '"Elevator, not an escalator. Straight down, straight up."',
    amrapTip:
      'Do not push off the back toe to stand up. Pull yourself up by driving through the heel of the front foot.',
    photos: sequencePhotos('strict-reverse-lunges'),
  },
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    setupAndExecution: [
      'Step forward into a lunge. Instead of pushing backward to return, drive off the front foot to immediately step forward into the next lunge on the opposite leg.',
    ],
    commonMistakes: [],
    coachingCue: '"Smooth forward momentum."',
    amrapTip:
      'Keep your torso vertical. If you lean forward over your front knee as you walk, you are putting massive shear force on the patella.',
    photos: sequencePhotos('walking-lunges'),
  },
];

// Force a full reload when this data module changes — partial HMR can leave
// photo paths stuck as the previous empty arrays in the browser.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
