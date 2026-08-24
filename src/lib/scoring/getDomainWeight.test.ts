import { describe, it, expect } from 'vitest';
import { getDomainWeight } from './getDomainWeight';

describe('getDomainWeight', () => {
  it('maps standard time domains to physiological weights', () => {
    expect(getDomainWeight(5)).toBe(1.0);
    expect(getDomainWeight(10)).toBe(1.2);
    expect(getDomainWeight(15)).toBe(1.5);
    expect(getDomainWeight(20)).toBe(1.8);
  });

  it('defaults unrecognized durations to 1.0', () => {
    expect(getDomainWeight(7)).toBe(1.0);
    expect(getDomainWeight(30)).toBe(1.0);
  });
});
