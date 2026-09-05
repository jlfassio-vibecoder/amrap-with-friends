import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY, getExerciseInfo } from './exerciseLibrary';
import { EXERCISE_PATTERN_TAGS } from '@/lib/smartRecovery/exercisePatternTags';
import { isMovementPattern } from '@/lib/smartRecovery/movementPatterns';

describe('getExerciseInfo', () => {
  it('returns the Burpees entry when found', () => {
    const info = getExerciseInfo('Burpees');
    expect(info?.id).toBe('burpees');
    expect(info?.name).toBe('Burpees');
    expect(info?.amrapTip).toBeTruthy();
  });

  it('matches case-insensitively', () => {
    expect(getExerciseInfo('burpees')?.id).toBe('burpees');
    expect(getExerciseInfo('BURPEES')?.id).toBe('burpees');
  });

  it('returns undefined when no entry exists', () => {
    expect(getExerciseInfo('Totally Fake Movement')).toBeUndefined();
  });

  it('matches generic Push-ups to the Push-ups entry', () => {
    expect(getExerciseInfo('Push-ups')?.id).toBe('push-ups');
  });

  it('keeps Fast Air Squats separate from Air Squats', () => {
    expect(getExerciseInfo('Fast Air Squats')?.id).toBe('fast-air-squats');
    expect(getExerciseInfo('Air Squats')?.id).toBe('air-squat');
  });

  it('matches exact names for new seeded entries', () => {
    expect(getExerciseInfo('Air Squats')?.id).toBe('air-squat');
    expect(getExerciseInfo('Skater Jumps')?.id).toBe('skater-jumps');
    expect(getExerciseInfo('Commando Planks')?.id).toBe('commando-planks');
  });

  it('strips a trailing parenthetical and matches the base name', () => {
    expect(getExerciseInfo('Skater Jumps (Total)')?.id).toBe('skater-jumps');
    expect(getExerciseInfo('Commando Planks (Up-Downs)')?.id).toBe('commando-planks');
    expect(getExerciseInfo('Jumping Lunges (Total)')?.id).toBe('jumping-lunges');
    expect(getExerciseInfo('Surrenders (Kneel-to-Stand)')?.id).toBe('surrenders');
    expect(getExerciseInfo('T-Push-ups (Rotate & Reach)')?.id).toBe('t-push-ups');
    expect(getExerciseInfo('Broad Jumps (Turn and repeat)')?.id).toBe('broad-jumps');
  });

  it('prefers an exact match over parenthetical stripping', () => {
    expect(getExerciseInfo('Standard Push-ups')?.id).toBe('standard-push-ups');
  });

  it('does not match Wide Push-ups to Wide-Grip Push-ups', () => {
    expect(getExerciseInfo('Wide Push-ups')?.id).toBe('wide-push-ups');
    expect(getExerciseInfo('Wide-Grip Push-ups')?.id).toBe('wide-grip-push-ups');
  });

  it('matches Localized Trap entries by exact name', () => {
    expect(getExerciseInfo('Bottom Squat Hold')?.id).toBe('bottom-squat-hold');
    expect(getExerciseInfo('Sphinx Push-ups')?.id).toBe('sphinx-push-ups');
    expect(getExerciseInfo('Floor Dips')?.id).toBe('floor-dips');
    expect(getExerciseInfo('Hollow Hold')?.id).toBe('hollow-hold');
    expect(getExerciseInfo('Reverse Lunges')?.id).toBe('reverse-lunges');
    expect(getExerciseInfo('Single-Leg Glute Bridges')?.id).toBe('single-leg-glute-bridges');
    expect(getExerciseInfo('Standard Glute Bridges')?.id).toBe('standard-glute-bridges');
    expect(getExerciseInfo('Wide Push-ups')?.id).toBe('wide-push-ups');
    expect(getExerciseInfo('Side Plank Dips')?.id).toBe('side-plank-dips');
    expect(getExerciseInfo('Pogo Jumps')?.id).toBe('pogo-jumps');
    expect(getExerciseInfo('Fast Calf Raises')?.id).toBe('fast-calf-raises');
  });

  it('strips parenthetical for Sphinx Push-ups from Localized Trap templates', () => {
    expect(getExerciseInfo('Sphinx Push-ups (Forearm to hand)')?.id).toBe('sphinx-push-ups');
  });

  it('strips parenthetical for batch 2 Localized Trap template names', () => {
    expect(getExerciseInfo('Reverse Lunges (Total)')?.id).toBe('reverse-lunges');
    expect(getExerciseInfo('Single-Leg Glute Bridges (5/leg)')?.id).toBe(
      'single-leg-glute-bridges'
    );
    expect(getExerciseInfo('Side Plank Dips (Left)')?.id).toBe('side-plank-dips');
    expect(getExerciseInfo('Side Plank Dips (Right)')?.id).toBe('side-plank-dips');
  });

  it('keeps Glute Bridges separate from Standard Glute Bridges', () => {
    expect(getExerciseInfo('Glute Bridges')?.id).toBe('glute-bridges');
    expect(getExerciseInfo('Standard Glute Bridges')?.id).toBe('standard-glute-bridges');
  });

  it('carries common mistakes for Localized Trap entries', () => {
    for (const name of ['Bottom Squat Hold', 'Hollow Hold', 'Reverse Lunges', 'Pogo Jumps']) {
      expect(getExerciseInfo(name)?.commonMistakes.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it('matches Engine Room entries by exact name', () => {
    expect(getExerciseInfo('Sprawls')?.id).toBe('sprawls');
    expect(getExerciseInfo('Combat Sprawls')?.id).toBe('combat-sprawls');
    expect(getExerciseInfo('Down-Ups')?.id).toBe('down-ups');
    expect(getExerciseInfo('Half-Burpees')?.id).toBe('half-burpees');
    expect(getExerciseInfo('Mountain Climbers')?.id).toBe('mountain-climbers');
    expect(getExerciseInfo('Cross-Body Mountain Climbers')?.id).toBe(
      'cross-body-mountain-climbers'
    );
    expect(getExerciseInfo('High Knees')?.id).toBe('high-knees');
    expect(getExerciseInfo('Butt Kicks')?.id).toBe('butt-kicks');
    expect(getExerciseInfo('Jumping Jacks')?.id).toBe('jumping-jacks');
    expect(getExerciseInfo('Lateral Line Hops')?.id).toBe('lateral-line-hops');
    expect(getExerciseInfo('Double-Tap Jumps')?.id).toBe('double-tap-jumps');
  });

  it('keeps Combat Sprawls separate from Sprawls', () => {
    expect(getExerciseInfo('Sprawls')?.id).toBe('sprawls');
    expect(getExerciseInfo('Combat Sprawls')?.id).toBe('combat-sprawls');
  });

  it('strips parenthetical for Engine Room template names', () => {
    expect(getExerciseInfo('Sprawls (No-Push-up Burpees)')?.id).toBe('sprawls');
    expect(getExerciseInfo('Mountain Climbers (Total)')?.id).toBe('mountain-climbers');
    expect(getExerciseInfo('High Knees (Total)')?.id).toBe('high-knees');
    expect(getExerciseInfo('Butt Kicks (Total)')?.id).toBe('butt-kicks');
    expect(getExerciseInfo('Half-Burpees (Plank to squat stance)')?.id).toBe('half-burpees');
    expect(getExerciseInfo('Double-Tap Jumps (Penguin Taps)')?.id).toBe('double-tap-jumps');
  });

  it('keeps Cross-Body Mountain Climbers separate from Mountain Climbers', () => {
    expect(getExerciseInfo('Mountain Climbers')?.id).toBe('mountain-climbers');
    expect(getExerciseInfo('Cross-Body Mountain Climbers')?.id).toBe(
      'cross-body-mountain-climbers'
    );
  });

  it('carries common mistakes for Engine Room entries', () => {
    for (const name of ['Sprawls', 'Jumping Jacks']) {
      expect(getExerciseInfo(name)?.commonMistakes.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it('matches Midline Tension entries by exact name', () => {
    expect(getExerciseInfo('V-Ups')?.id).toBe('v-ups');
    expect(getExerciseInfo('Strict Sit-Ups')?.id).toBe('strict-sit-ups');
    expect(getExerciseInfo('Leg Raises')?.id).toBe('leg-raises');
    expect(getExerciseInfo('Russian Twists')?.id).toBe('russian-twists');
    expect(getExerciseInfo('Bicycle Crunches')?.id).toBe('bicycle-crunches');
    expect(getExerciseInfo('Plank Knee-to-Elbows')?.id).toBe('plank-knee-to-elbows');
    expect(getExerciseInfo('Dead Bugs')?.id).toBe('dead-bugs');
    expect(getExerciseInfo('Flutter Kicks')?.id).toBe('flutter-kicks');
    expect(getExerciseInfo('Superman Raises')?.id).toBe('superman-raises');
  });

  it('keeps Plank Knee-to-Elbows separate from Plank Shoulder Taps', () => {
    expect(getExerciseInfo('Plank Knee-to-Elbows')?.id).toBe('plank-knee-to-elbows');
    expect(getExerciseInfo('Plank Shoulder Taps')?.id).toBe('plank-shoulder-taps');
  });

  it('carries common mistakes for Midline Tension entries', () => {
    for (const name of ['Dead Bugs', 'Flutter Kicks']) {
      expect(getExerciseInfo(name)?.commonMistakes.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it('matches remaining dictionary entries by exact name', () => {
    expect(getExerciseInfo('Alternating Bird-Dogs')?.id).toBe('alternating-bird-dogs');
    expect(getExerciseInfo('Bear Crawl Hover')?.id).toBe('bear-crawl-hover');
    expect(getExerciseInfo('High Plank Hold')?.id).toBe('high-plank-hold');
    expect(getExerciseInfo('Hollow Rocks')?.id).toBe('hollow-rocks');
    expect(getExerciseInfo('Plank Hold')?.id).toBe('plank-hold');
    expect(getExerciseInfo('Plank Reaches')?.id).toBe('plank-reaches');
    expect(getExerciseInfo('Side Plank Hold')?.id).toBe('side-plank-hold');
    expect(getExerciseInfo('V-Sit Hold')?.id).toBe('v-sit-hold');
    expect(getExerciseInfo('Butterfly Sit-ups')?.id).toBe('butterfly-sit-ups');
    expect(getExerciseInfo('Cross-Body Climbers')?.id).toBe('cross-body-climbers');
    expect(getExerciseInfo('Bodyweight Good Mornings')?.id).toBe('bodyweight-good-mornings');
    expect(getExerciseInfo('Glute Bridge Hold')?.id).toBe('glute-bridge-hold');
    expect(getExerciseInfo('Glute Bridge Walkouts')?.id).toBe('glute-bridge-walkouts');
    expect(getExerciseInfo('Reverse Snow Angels')?.id).toBe('reverse-snow-angels');
    expect(getExerciseInfo('Superman Hold')?.id).toBe('superman-hold');
    expect(getExerciseInfo('Superman Pull-downs')?.id).toBe('superman-pull-downs');
    expect(getExerciseInfo('Supermans')?.id).toBe('supermans');
    expect(getExerciseInfo('Bear Crawl to Broad Jumps')?.id).toBe('bear-crawl-to-broad-jumps');
    expect(getExerciseInfo('Strict Reverse Lunges')?.id).toBe('strict-reverse-lunges');
    expect(getExerciseInfo('Walking Lunges')?.id).toBe('walking-lunges');
  });

  it('strips parentheticals for remaining dictionary template names', () => {
    expect(getExerciseInfo('Plank Reaches (Total)')?.id).toBe('plank-reaches');
    expect(getExerciseInfo('Side Plank Hold (Switch sides each round)')?.id).toBe(
      'side-plank-hold'
    );
  });

  it('keeps Cross-Body Climbers separate from Cross-Body Mountain Climbers', () => {
    expect(getExerciseInfo('Cross-Body Climbers')?.id).toBe('cross-body-climbers');
    expect(getExerciseInfo('Cross-Body Mountain Climbers')?.id).toBe(
      'cross-body-mountain-climbers'
    );
  });

  it('keeps High Plank Hold separate from Plank Hold', () => {
    expect(getExerciseInfo('High Plank Hold')?.id).toBe('high-plank-hold');
    expect(getExerciseInfo('Plank Hold')?.id).toBe('plank-hold');
  });

  it('keeps Supermans separate from Superman Raises and Superman Hold', () => {
    expect(getExerciseInfo('Supermans')?.id).toBe('supermans');
    expect(getExerciseInfo('Superman Raises')?.id).toBe('superman-raises');
    expect(getExerciseInfo('Superman Hold')?.id).toBe('superman-hold');
  });
});

describe('EXERCISE_LIBRARY primaryPatterns', () => {
  it('assigns at least one valid pattern to every entry', () => {
    for (const entry of EXERCISE_LIBRARY) {
      expect(entry.primaryPatterns.length, entry.id).toBeGreaterThan(0);
      for (const pattern of entry.primaryPatterns) {
        expect(isMovementPattern(pattern), `${entry.id}:${pattern}`).toBe(true);
      }
    }
  });

  it('matches EXERCISE_PATTERN_TAGS keys to library ids exactly', () => {
    const libraryIds = new Set(EXERCISE_LIBRARY.map((entry) => entry.id));
    const tagIds = new Set(Object.keys(EXERCISE_PATTERN_TAGS));
    expect(tagIds).toEqual(libraryIds);
  });

  it('exposes primaryPatterns through getExerciseInfo', () => {
    expect(getExerciseInfo('Burpees')?.primaryPatterns).toEqual(['full-body-conditioning']);
  });
});
