import { describe, it, expect } from 'vitest';
import { getExerciseInfo } from './exerciseLibrary';

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
    expect(getExerciseInfo('Hollow Rocks')).toBeUndefined();
  });

  it('does not match a generic Push-ups name to a specific variant', () => {
    expect(getExerciseInfo('Push-ups')).toBeUndefined();
  });

  it('does not match prefix modifiers like Fast Air Squats', () => {
    expect(getExerciseInfo('Fast Air Squats')).toBeUndefined();
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
    expect(getExerciseInfo('Single-Leg Glute Bridges')?.id).toBe(
      'single-leg-glute-bridges'
    );
    expect(getExerciseInfo('Standard Glute Bridges')?.id).toBe(
      'standard-glute-bridges'
    );
    expect(getExerciseInfo('Wide Push-ups')?.id).toBe('wide-push-ups');
    expect(getExerciseInfo('Side Plank Dips')?.id).toBe('side-plank-dips');
    expect(getExerciseInfo('Pogo Jumps')?.id).toBe('pogo-jumps');
    expect(getExerciseInfo('Fast Calf Raises')?.id).toBe('fast-calf-raises');
  });

  it('strips parenthetical for Sphinx Push-ups from Localized Trap templates', () => {
    expect(getExerciseInfo('Sphinx Push-ups (Forearm to hand)')?.id).toBe(
      'sphinx-push-ups'
    );
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
    expect(getExerciseInfo('Standard Glute Bridges')?.id).toBe(
      'standard-glute-bridges'
    );
  });

  it('hides empty common mistakes for Localized Trap entries', () => {
    expect(getExerciseInfo('Bottom Squat Hold')?.commonMistakes).toEqual([]);
    expect(getExerciseInfo('Hollow Hold')?.commonMistakes).toEqual([]);
    expect(getExerciseInfo('Reverse Lunges')?.commonMistakes).toEqual([]);
    expect(getExerciseInfo('Pogo Jumps')?.commonMistakes).toEqual([]);
  });

  it('matches Engine Room entries by exact name', () => {
    expect(getExerciseInfo('Sprawls')?.id).toBe('sprawls');
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

  it('strips parenthetical for Engine Room template names', () => {
    expect(getExerciseInfo('Sprawls (No-Push-up Burpees)')?.id).toBe('sprawls');
    expect(getExerciseInfo('Mountain Climbers (Total)')?.id).toBe(
      'mountain-climbers'
    );
    expect(getExerciseInfo('High Knees (Total)')?.id).toBe('high-knees');
    expect(getExerciseInfo('Butt Kicks (Total)')?.id).toBe('butt-kicks');
    expect(getExerciseInfo('Half-Burpees (Plank to squat stance)')?.id).toBe(
      'half-burpees'
    );
    expect(getExerciseInfo('Double-Tap Jumps (Penguin Taps)')?.id).toBe(
      'double-tap-jumps'
    );
  });

  it('keeps Cross-Body Mountain Climbers separate from Mountain Climbers', () => {
    expect(getExerciseInfo('Mountain Climbers')?.id).toBe('mountain-climbers');
    expect(getExerciseInfo('Cross-Body Mountain Climbers')?.id).toBe(
      'cross-body-mountain-climbers'
    );
  });

  it('hides empty common mistakes for Engine Room entries', () => {
    expect(getExerciseInfo('Sprawls')?.commonMistakes).toEqual([]);
    expect(getExerciseInfo('Jumping Jacks')?.commonMistakes).toEqual([]);
  });

  it('matches Midline Tension entries by exact name', () => {
    expect(getExerciseInfo('V-Ups')?.id).toBe('v-ups');
    expect(getExerciseInfo('Strict Sit-Ups')?.id).toBe('strict-sit-ups');
    expect(getExerciseInfo('Leg Raises')?.id).toBe('leg-raises');
    expect(getExerciseInfo('Russian Twists')?.id).toBe('russian-twists');
    expect(getExerciseInfo('Bicycle Crunches')?.id).toBe('bicycle-crunches');
    expect(getExerciseInfo('Plank Knee-to-Elbows')?.id).toBe(
      'plank-knee-to-elbows'
    );
    expect(getExerciseInfo('Dead Bugs')?.id).toBe('dead-bugs');
    expect(getExerciseInfo('Flutter Kicks')?.id).toBe('flutter-kicks');
    expect(getExerciseInfo('Superman Raises')?.id).toBe('superman-raises');
  });

  it('keeps Plank Knee-to-Elbows separate from Plank Shoulder Taps', () => {
    expect(getExerciseInfo('Plank Knee-to-Elbows')?.id).toBe(
      'plank-knee-to-elbows'
    );
    expect(getExerciseInfo('Plank Shoulder Taps')?.id).toBe('plank-shoulder-taps');
  });

  it('hides empty common mistakes for Midline Tension entries', () => {
    expect(getExerciseInfo('Dead Bugs')?.commonMistakes).toEqual([]);
    expect(getExerciseInfo('Flutter Kicks')?.commonMistakes).toEqual([]);
  });
});
