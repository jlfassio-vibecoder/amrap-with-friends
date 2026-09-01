import { describe, expect, it } from 'vitest';
import { backFallbackFor } from './backFallback';

describe('backFallbackFor', () => {
  it('sends movement pages to the exercise hub', () => {
    expect(backFallbackFor('/exercises/burpees')).toBe('/exercises');
  });

  it('sends workout pages to their duration collection', () => {
    expect(backFallbackFor('/amrap-workouts/5-minute/the-hull-breach')).toBe(
      '/amrap-workouts/5-minute'
    );
  });

  it('sends style and duration collections to the workouts hub', () => {
    expect(backFallbackFor('/amrap-workouts/style/blood-shunt')).toBe('/amrap-workouts');
    expect(backFallbackFor('/amrap-workouts/10-minute')).toBe('/amrap-workouts');
  });

  it('sends hubs to home', () => {
    expect(backFallbackFor('/exercises')).toBe('/');
    expect(backFallbackFor('/amrap-workouts')).toBe('/');
  });

  it('defaults everything else to home', () => {
    expect(backFallbackFor('/about')).toBe('/');
    expect(backFallbackFor('/')).toBe('/');
  });
});
