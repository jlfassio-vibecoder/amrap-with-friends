import { describe, expect, it } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { brandNameForDomain } from '@/data/timeDomainGuidance';
import { MAX_CHAIN_LENGTH } from '@/lib/mission/chainRest';
import {
  CAMPAIGN_MISSION_PRESETS,
  CHAIN_MISSION_PRESETS,
  groupPresetsByCategory,
  presetCategoryLabel,
  resolveChainPresetTemplates,
} from './planMissionPresets';

describe('planMissionPresets', () => {
  it('resolves every chain preset against the workout library', () => {
    for (const preset of CHAIN_MISSION_PRESETS) {
      const templates = resolveChainPresetTemplates(preset);
      expect(templates).toHaveLength(preset.templateIds.length);
      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates.length).toBeLessThanOrEqual(MAX_CHAIN_LENGTH);
      expect(templates.every((template) => WORKOUT_TEMPLATES.includes(template))).toBe(true);
    }
  });

  it('keeps chain packs inside a single time domain matching their label domains', () => {
    for (const preset of CHAIN_MISSION_PRESETS) {
      const templates = resolveChainPresetTemplates(preset);
      const domains = new Set(templates.map((template) => template.durationMinutes));
      expect(domains.size).toBe(1);
      expect(preset.domains).toEqual([...domains]);
    }
  });

  it('defines three campaign packs with valid tracks and week counts', () => {
    expect(CAMPAIGN_MISSION_PRESETS).toHaveLength(3);
    for (const preset of CAMPAIGN_MISSION_PRESETS) {
      expect(preset.name).toMatch(/\d+-week/);
      expect(preset.tracks.length).toBeGreaterThanOrEqual(1);
      expect(preset.missionsPerWeek).toBeGreaterThanOrEqual(1);
      expect([2, 4, 6, 8, 12]).toContain(preset.weekCount);
      expect(preset.domains).toEqual([
        ...new Set(preset.tracks.map((track) => track.durationMinutes)),
      ]);
    }
  });

  it('labels packs with Sprint / Crucible / Grind brands from the fitness guide', () => {
    expect(presetCategoryLabel([5]).brandName).toBe('Sprint');
    expect(presetCategoryLabel([10]).brandName).toBe('Crucible');
    expect(presetCategoryLabel([15]).brandName).toBe('Grind');
    expect(presetCategoryLabel([10, 15]).brandName).toBe('Crucible + Grind');
    expect(presetCategoryLabel([5]).tagline).toBeTruthy();
  });

  it('groups chains under Sprint, Crucible, and Grind', () => {
    const groups = groupPresetsByCategory(CHAIN_MISSION_PRESETS);
    expect(groups.map((group) => group.label.brandName)).toEqual(['Sprint', 'Crucible', 'Grind']);
    expect(groups.every((group) => group.presets.length >= 1)).toBe(true);
  });

  it('groups campaigns under Crucible, Crucible + Grind, and Grind', () => {
    const groups = groupPresetsByCategory(CAMPAIGN_MISSION_PRESETS);
    expect(groups.map((group) => group.label.brandName)).toEqual([
      'Crucible',
      'Crucible + Grind',
      'Grind',
    ]);
    for (const group of groups) {
      for (const preset of group.presets) {
        expect(group.label.brandName).toBe(
          preset.domains.map((domain) => brandNameForDomain(domain)).join(' + ')
        );
      }
    }
  });
});
