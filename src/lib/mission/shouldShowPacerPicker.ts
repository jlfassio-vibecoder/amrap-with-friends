/**
 * Whether the rally point offers a pacer for this mission.
 *
 * This used to require `participantCount === 1`. The ghost shipped as a
 * solo-training feature, and racing a stored curve while a squad watched the
 * same clock looked like a distraction from the people in the room.
 *
 * The same-variant ghost changes who that gate was excluding. An athlete who
 * modifies a movement is often the one who feels furthest behind in a group, and
 * their best previous run of that exact version is the one number on the screen
 * that is actually theirs to beat — the live leaderboard is not, because the
 * others are doing a different version of the workout. Withholding it in the
 * setting where it matters most was the wrong trade.
 *
 * A pacer is still a private choice: everyone picks their own, nobody else sees
 * it, and "None" remains the default.
 */
export function shouldShowPacerPicker(input: {
  templateId: string | null;
  phase: string;
}): boolean {
  // A ghost is a previous run of *this* workout, so an ad-hoc mission with no
  // template has nothing to look up.
  if (input.templateId === null) {
    return false;
  }
  // Chosen before the clock starts, never mid-mission.
  return input.phase === 'waiting';
}
