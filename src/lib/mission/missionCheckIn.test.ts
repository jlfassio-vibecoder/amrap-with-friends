import { describe, expect, it } from 'vitest';
import { CHECK_IN_DIMENSIONS, RPE_OPTIONS } from '@/data/missionCheckIn';
import {
  MAX_SESSION_NOTES_LENGTH,
  normalizeCheckIns,
  normalizeRpe,
  normalizeSessionNotes,
} from '@/lib/mission/missionCheckIn';

describe('missionCheckIn catalog', () => {
  it('pins RPE to 1–10 with unique labels', () => {
    expect(RPE_OPTIONS.map((option) => option.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(RPE_OPTIONS.map((option) => option.label)).size).toBe(10);
  });

  it('pins check-in option ids', () => {
    const ids = CHECK_IN_DIMENSIONS.flatMap((dimension) =>
      dimension.options.map((option) => option.id)
    );
    expect(ids).toEqual([
      'energy--low',
      'energy--ok',
      'energy--high',
      'soreness--none',
      'soreness--mild',
      'soreness--heavy',
      'sleep--poor',
      'sleep--ok',
      'sleep--good',
      'mood--off',
      'mood--steady',
      'mood--locked-in',
      'pain--felt',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('normalizeRpe', () => {
  it('keeps an integer in range', () => {
    expect(normalizeRpe(7)).toBe(7);
  });

  it('drops out-of-range and non-integers', () => {
    expect(normalizeRpe(0)).toBeNull();
    expect(normalizeRpe(11)).toBeNull();
    expect(normalizeRpe(7.5)).toBeNull();
    expect(normalizeRpe('7')).toBeNull();
    expect(normalizeRpe(null)).toBeNull();
  });
});

describe('normalizeSessionNotes', () => {
  it('trims and caps length', () => {
    expect(normalizeSessionNotes('  held back on round three  ')).toBe('held back on round three');
    expect(normalizeSessionNotes('x'.repeat(MAX_SESSION_NOTES_LENGTH + 20)).length).toBe(
      MAX_SESSION_NOTES_LENGTH
    );
  });
});

describe('normalizeCheckIns', () => {
  it('keeps a known option on its own dimension', () => {
    expect(
      normalizeCheckIns({
        energy: 'energy--ok',
        starting_soreness: 'soreness--mild',
        pain: 'pain--felt',
      })
    ).toEqual({
      energy: 'energy--ok',
      starting_soreness: 'soreness--mild',
      pain: 'pain--felt',
    });
  });

  it('drops unknown keys, unknown ids, and cross-dimension ids', () => {
    expect(
      normalizeCheckIns({
        energy: 'soreness--mild',
        sleep: 'sleep--retired',
        mystery: 'energy--ok',
      })
    ).toEqual({});
  });

  it('rejects non-objects', () => {
    expect(normalizeCheckIns(null)).toEqual({});
    expect(normalizeCheckIns(['energy--ok'])).toEqual({});
  });
});
