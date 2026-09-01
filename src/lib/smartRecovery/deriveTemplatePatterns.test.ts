import { describe, expect, it } from 'vitest';
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from '@/data/workoutTemplates';
import { deriveTemplatePrimaryPatterns } from './deriveTemplatePatterns';

function templateById(id: string): WorkoutTemplate {
  const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
  if (!template) {
    throw new Error(`Missing template ${id}`);
  }
  return template;
}

describe('deriveTemplatePrimaryPatterns', () => {
  it('derives lower-body patterns for blood-shunt the-piston', () => {
    const patterns = deriveTemplatePrimaryPatterns(templateById('the-piston'));
    expect(patterns).toContain('lower-body');
    expect(patterns).not.toEqual(['full-body-conditioning']);
  });

  it('derives upper patterns for localized-trap equilibrium', () => {
    const patterns = deriveTemplatePrimaryPatterns(templateById('equilibrium'));
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((pattern) => pattern === 'upper-push' || pattern === 'upper-pull')).toBe(
      true
    );
  });

  it('derives conditioning for engine-room the-gas-pedal', () => {
    const patterns = deriveTemplatePrimaryPatterns(templateById('the-gas-pedal'));
    expect(patterns).toContain('full-body-conditioning');
  });

  it('derives core for midline-tension the-hull-breach', () => {
    const patterns = deriveTemplatePrimaryPatterns(templateById('the-hull-breach'));
    expect(patterns).toContain('core');
  });

  it('derives patterns for aerobic-matrix the-pacer', () => {
    expect(deriveTemplatePrimaryPatterns(templateById('the-pacer')).length).toBeGreaterThan(0);
  });

  it('derives patterns for four-point-cascade the-baseline', () => {
    expect(deriveTemplatePrimaryPatterns(templateById('the-baseline')).length).toBeGreaterThan(0);
  });

  it('derives patterns for armor-protocol the-stronghold', () => {
    expect(deriveTemplatePrimaryPatterns(templateById('the-stronghold')).length).toBeGreaterThan(0);
  });

  it('falls back to category defaults for unknown movements', () => {
    const template: WorkoutTemplate = {
      ...templateById('the-gas-pedal'),
      movements: [{ name: 'Totally Fake Movement' }],
    };
    expect(deriveTemplatePrimaryPatterns(template)).toEqual(['full-body-conditioning']);
  });

  it('returns empty for localized-trap with only unknown movements', () => {
    const template: WorkoutTemplate = {
      ...templateById('equilibrium'),
      movements: [{ name: 'Totally Fake Movement' }],
    };
    expect(deriveTemplatePrimaryPatterns(template)).toEqual([]);
  });

  it('resolves at least one pattern for every library template', () => {
    for (const template of WORKOUT_TEMPLATES) {
      expect(deriveTemplatePrimaryPatterns(template).length, template.id).toBeGreaterThan(0);
    }
  });

  it('caps results at two patterns', () => {
    const patterns = deriveTemplatePrimaryPatterns(templateById('the-pacer'));
    expect(patterns.length).toBeLessThanOrEqual(2);
  });
});
