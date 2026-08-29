import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { assignCampaignWorkouts } from './assignCampaignWorkouts';
import { buildCampaignCalendar } from './buildCampaignCalendar';
import { CampaignValidationError, type CampaignOccurrence } from './types';

function template(id: string, durationMinutes: 5 | 10, category: 'blood-shunt' | 'engine-room') {
  return {
    id,
    name: id.toUpperCase(),
    durationMinutes,
    category,
    intensityTier: 3,
    movements: [{ name: 'Burpees', reps: 10 }],
    tacticalNote: 'note',
  } satisfies WorkoutTemplate;
}

const TEMPLATES: WorkoutTemplate[] = [
  template('bs-1', 5, 'blood-shunt'),
  template('bs-2', 5, 'blood-shunt'),
  template('bs-3', 5, 'blood-shunt'),
  template('er-1', 10, 'engine-room'),
  template('er-2', 10, 'engine-room'),
];

const TRACKS = [
  { durationMinutes: 5, category: 'blood-shunt' },
  { durationMinutes: 10, category: 'engine-room' },
] as const;

function occurrences(count: number): CampaignOccurrence[] {
  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    weekNumber: Math.floor(index / 2) + 1,
    slotNumber: (index % 2) + 1,
    localDate: '2026-03-02',
    localTime: '18:00',
    weekday: 1,
  }));
}

describe('assignCampaignWorkouts', () => {
  it('assigns a workout to every occurrence', () => {
    const planned = assignCampaignWorkouts({
      occurrences: occurrences(6),
      tracks: [...TRACKS],
      templates: TEMPLATES,
    });
    expect(planned).toHaveLength(6);
    expect(planned.every((entry) => entry.templateId.length > 0)).toBe(true);
  });

  it('preserves the occurrence fields it was given', () => {
    const [first] = assignCampaignWorkouts({
      occurrences: occurrences(1),
      tracks: [TRACKS[0]],
      templates: TEMPLATES,
    });
    expect(first.sequence).toBe(1);
    expect(first.weekNumber).toBe(1);
    expect(first.localDate).toBe('2026-03-02');
    expect(first.localTime).toBe('18:00');
  });

  it('rotates across tracks so consecutive sessions vary the stimulus', () => {
    const planned = assignCampaignWorkouts({
      occurrences: occurrences(4),
      tracks: [...TRACKS],
      templates: TEMPLATES,
    });
    expect(planned.map((entry) => entry.category)).toEqual([
      'blood-shunt',
      'engine-room',
      'blood-shunt',
      'engine-room',
    ]);
    expect(planned.map((entry) => entry.durationMinutes)).toEqual([5, 10, 5, 10]);
  });

  it('walks each track pool in order before repeating within it', () => {
    const planned = assignCampaignWorkouts({
      occurrences: occurrences(6),
      tracks: [...TRACKS],
      templates: TEMPLATES,
    });
    expect(planned.map((entry) => entry.templateId)).toEqual([
      'bs-1',
      'er-1',
      'bs-2',
      'er-2',
      'bs-3',
      'er-1',
    ]);
  });

  it('cycles a pool that is shorter than the campaign', () => {
    const planned = assignCampaignWorkouts({
      occurrences: occurrences(5),
      tracks: [TRACKS[1]],
      templates: TEMPLATES,
    });
    expect(planned.map((entry) => entry.templateId)).toEqual([
      'er-1',
      'er-2',
      'er-1',
      'er-2',
      'er-1',
    ]);
  });

  it('never repeats a workout back to back', () => {
    const planned = assignCampaignWorkouts({
      occurrences: occurrences(12),
      tracks: [...TRACKS],
      templates: TEMPLATES,
    });
    for (let index = 1; index < planned.length; index += 1) {
      expect(planned[index].templateId).not.toBe(planned[index - 1].templateId);
    }
  });

  it('is deterministic across runs', () => {
    const args = {
      occurrences: occurrences(8),
      tracks: [...TRACKS],
      templates: TEMPLATES,
    };
    expect(assignCampaignWorkouts(args)).toEqual(assignCampaignWorkouts(args));
  });

  it('rejects a campaign with no tracks', () => {
    expect(() =>
      assignCampaignWorkouts({ occurrences: occurrences(2), tracks: [], templates: TEMPLATES })
    ).toThrow(CampaignValidationError);
  });

  it('rejects a track the library cannot fill', () => {
    expect(() =>
      assignCampaignWorkouts({
        occurrences: occurrences(2),
        tracks: [{ durationMinutes: 20, category: 'blood-shunt' }],
        templates: TEMPLATES,
      })
    ).toThrow(CampaignValidationError);
  });

  it('plans a full 12-week campaign from the shipped library', () => {
    const calendar = buildCampaignCalendar({
      weekCount: 12,
      startDate: '2026-03-02',
      slots: [
        { weekday: 1, timeLocal: '06:00' },
        { weekday: 3, timeLocal: '06:00' },
        { weekday: 5, timeLocal: '06:00' },
      ],
    });
    const planned = assignCampaignWorkouts({
      occurrences: calendar.occurrences,
      tracks: [
        { durationMinutes: 5, category: 'blood-shunt' },
        { durationMinutes: 10, category: 'engine-room' },
        { durationMinutes: 15, category: 'midline-tension' },
      ],
    });

    expect(planned).toHaveLength(36);
    // Ten templates per track x three tracks: thirty sessions before any repeat.
    expect(new Set(planned.slice(0, 30).map((entry) => entry.templateId)).size).toBe(30);
    expect(planned.every((entry) => entry.workoutName.length > 0)).toBe(true);
  });
});
