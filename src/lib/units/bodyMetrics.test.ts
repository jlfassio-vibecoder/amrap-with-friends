import { describe, expect, it } from 'vitest';
import {
  cmToIn,
  inToCm,
  isValidHeight,
  isValidWeight,
  kgToLb,
  lbToKg,
} from './bodyMetrics';

describe('bodyMetrics', () => {
  it('converts height cm ↔ in with integer rounding', () => {
    expect(cmToIn(180)).toBe(71);
    expect(inToCm(71)).toBe(180);
    expect(inToCm(70)).toBe(178);
  });

  it('converts weight kg ↔ lb to one decimal', () => {
    expect(kgToLb(80)).toBe(176.4);
    expect(lbToKg(176.4)).toBe(80);
  });

  it('round-trips height within one inch of rounding', () => {
    for (const cm of [100, 150, 180, 200, 250]) {
      const back = inToCm(cmToIn(cm));
      expect(Math.abs(back - cm)).toBeLessThanOrEqual(1);
    }
  });

  it('round-trips weight within 0.1 kg', () => {
    for (const kg of [30, 70, 80, 100, 250]) {
      const back = lbToKg(kgToLb(kg));
      expect(Math.abs(back - kg)).toBeLessThanOrEqual(0.1);
    }
  });

  it('validates imperial and metric height ranges', () => {
    expect(isValidHeight(71, 'imperial')).toBe(true);
    expect(isValidHeight(39, 'imperial')).toBe(false);
    expect(isValidHeight(40, 'imperial')).toBe(true);
    expect(isValidHeight(180, 'metric')).toBe(true);
    expect(isValidHeight(99, 'metric')).toBe(false);
    expect(isValidHeight(71.5, 'imperial')).toBe(false);
  });

  it('validates imperial and metric weight ranges', () => {
    expect(isValidWeight(176.4, 'imperial')).toBe(true);
    expect(isValidWeight(65, 'imperial')).toBe(false);
    expect(isValidWeight(66, 'imperial')).toBe(false);
    expect(isValidWeight(66.1, 'imperial')).toBe(true);
    expect(isValidWeight(80, 'metric')).toBe(true);
    expect(isValidWeight(29, 'metric')).toBe(false);
  });
});
