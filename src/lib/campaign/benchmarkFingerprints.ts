import type { WorkoutTemplate } from '@/data/workoutTemplates';

/**
 * Score-affecting shape of a workout template, for CI freeze of campaign
 * benchmarks. Deliberately ignores name, focus and tacticalNote — those can
 * be copy-edited without invalidating recorded results.
 *
 * Format: `duration|category|Name:reps:unit|Name:reps:unit|…`
 * Empty reps/unit slots stay empty so a missing field is visible in the diff.
 */
export function fingerprintWorkoutTemplate(template: WorkoutTemplate): string {
  const movements = template.movements
    .map((movement) => `${movement.name}:${movement.reps ?? ''}:${movement.unit ?? ''}`)
    .join('|');
  return `${template.durationMinutes}|${template.category ?? ''}|${movements}`;
}

/**
 * Canonical fingerprints for every id in campaignBenchmarks.ts.
 *
 * **Do not edit a fingerprint to match a changed workout.** That silently
 * invalidates every result recorded against that id. Add a new template with a
 * new id, point the benchmark table at it, and add its fingerprint here in the
 * same commit.
 */
export const BENCHMARK_FINGERPRINTS: Record<string, string> = {
  'flash-flood': '5|blood-shunt|Skater Jumps (Total):12:|Wide-Grip Push-ups:10:',
  'the-gas-pedal': '5|engine-room|Burpees:10:|Jumping Jacks:20:',
  'quadra-kill': '5|localized-trap|Jumping Lunges (Total):12:|Reverse Lunges (Total):12:',
  'the-hull-breach': '5|midline-tension|Burpees:8:|Hollow Rocks:15:',
  'the-hemodynamic': '10|blood-shunt|Fast Air Squats:15:|Down-Ups:10:|Fast Calf Raises:20:',
  'constant-current': '10|engine-room|Sprawls:12:|Cross-Body Mountain Climbers:24:',
  equilibrium: '10|localized-trap|Standard Push-ups:12:|Reverse Snow Angels:15:',
  'the-iron-cross': '10|midline-tension|Plank Knee-to-Elbows:12:|Air Squats:15:|Jumping Jacks:20:',
  'the-piston-grind':
    '15|blood-shunt|Glute Bridges:20:|Dive-Bomber Push-ups:10:|Mountain Climbers:30:',
  'the-cruiser-endurance': '15|engine-room|Burpees:10:|Skater Jumps:20:|Mountain Climbers:30:',
  'the-equalizer': '15|localized-trap|Down-Ups:10:|Alternating Lunges:20:|Plank Knee-to-Elbows:16:',
  'the-suspended-bridge': '15|midline-tension|Superman Raises:15:|Glute Bridges:15:|Butt Kicks:30:',
  'the-pacer':
    '20|aerobic-matrix|T-Push-ups:10:|Reverse Lunges:20:|Russian Twists:15:|Skater Jumps:30:',
  'the-stronghold':
    '20|armor-protocol|Glute Bridge Hold:20:sec|Pike Push-ups:10:|Down-Ups:15:|Lateral Line Hops:20:',
  'the-baseline':
    '20|four-point-cascade|Jumping Jacks:20:|Hand-Release Push-ups:10:|Air Squats:20:|V-Ups:10:',
};
