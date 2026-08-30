import { describe, expect, it } from 'vitest';
import { campaignRoleDescription, campaignRoleLabel, deriveCampaignRoles } from './campaignRoles';
import { planCampaignWorkouts } from './planCampaignWorkouts';
import type { CampaignOccurrence } from './types';

function occurrences(weekCount: number, perWeek: number): CampaignOccurrence[] {
  const rows: CampaignOccurrence[] = [];
  for (let week = 1; week <= weekCount; week += 1) {
    for (let slot = 1; slot <= perWeek; slot += 1) {
      rows.push({
        sequence: rows.length + 1,
        weekNumber: week,
        slotNumber: slot,
        localDate: '2026-03-02',
        localTime: '18:00',
        weekday: 1,
      });
    }
  }
  return rows;
}

/** The shape the detail page has: week number and template id, nothing more. */
function rows(weekCount: number, perWeek: number, templateIds: (string | null)[]) {
  return occurrences(weekCount, perWeek).map((occurrence, index) => ({
    weekNumber: occurrence.weekNumber,
    templateId: templateIds[index] ?? null,
  }));
}

describe('deriveCampaignRoles', () => {
  it('has a role for every occurrence', () => {
    const roles = deriveCampaignRoles(rows(2, 2, ['a', 'b', 'c', 'a']));
    expect(roles).toHaveLength(4);
  });

  it('returns nothing for an empty campaign', () => {
    expect(deriveCampaignRoles([])).toEqual([]);
  });

  it('calls the opening session the benchmark and its repeats retests', () => {
    const roles = deriveCampaignRoles(rows(2, 2, ['a', 'b', 'c', 'a']));
    expect(roles).toEqual(['benchmark', 'build', 'build', 'retest']);
  });

  it('marks the easy day before a retest in a long campaign', () => {
    const roles = deriveCampaignRoles(rows(8, 1, ['a', 'b', 'c', 'a', 'd', 'e', 'f', 'a']));
    expect(roles).toEqual([
      'benchmark',
      'build',
      'deload',
      'retest',
      'build',
      'build',
      'deload',
      'retest',
    ]);
  });

  it('marks no easy day in a campaign too short to spend one', () => {
    const roles = deriveCampaignRoles(rows(6, 1, ['a', 'b', 'c', 'd', 'e', 'a']));
    expect(roles).toEqual(['benchmark', 'build', 'build', 'build', 'build', 'retest']);
  });

  it('never treats the opening session as an easy day', () => {
    // Two tests back to back would otherwise try to deload index -1 and 0.
    const roles = deriveCampaignRoles(rows(8, 1, ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']));
    expect(roles[0]).toBe('benchmark');
    expect(roles[1]).toBe('retest');
  });

  it('labels nothing when the opening workout is unknown', () => {
    const roles = deriveCampaignRoles(rows(2, 2, [null, 'b', 'c', null]));
    expect(roles.every((role) => role === 'build')).toBe(true);
  });

  it('labels nothing when the opening workout simply comes round again', () => {
    // A plain rotation repeats far more often than any campaign tests, and
    // claiming those are retests would promise a comparison the plan never made.
    const rotation = ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'];
    const roles = deriveCampaignRoles(rows(8, 1, rotation));
    expect(roles.every((role) => role === 'build')).toBe(true);
  });

  it('reads a plan the same way the planner built it', () => {
    const planned = planCampaignWorkouts({
      occurrences: occurrences(8, 3),
      tracks: [{ durationMinutes: 10, category: 'blood-shunt' }],
    });
    const roles = deriveCampaignRoles(planned);

    expect(roles[0]).toBe('benchmark');
    expect(roles[roles.length - 1]).toBe('retest');
    expect(roles.filter((role) => role === 'benchmark')).toHaveLength(1);
    expect(roles.filter((role) => role === 'retest')).toHaveLength(2);
    expect(roles.filter((role) => role === 'deload')).toHaveLength(2);

    // Every test runs the same workout, which is the whole point of the plan.
    const testIds = planned
      .filter((_, index) => roles[index] === 'benchmark' || roles[index] === 'retest')
      .map((entry) => entry.templateId);
    expect(new Set(testIds).size).toBe(1);

    // And every easy day sits immediately before one.
    roles.forEach((role, index) => {
      if (role === 'deload') {
        expect(roles[index + 1]).toBe('retest');
      }
    });
  });

  it('reads every campaign length the host can pick', () => {
    for (const weekCount of [2, 4, 6, 8, 12] as const) {
      const planned = planCampaignWorkouts({
        occurrences: occurrences(weekCount, 2),
        tracks: [{ durationMinutes: 15, category: 'engine-room' }],
      });
      const roles = deriveCampaignRoles(planned);
      expect(roles[0], `week count ${weekCount}`).toBe('benchmark');
      expect(roles[roles.length - 1], `week count ${weekCount}`).toBe('retest');
    }
  });
});

describe('campaignRoleLabel', () => {
  it('names the sessions that need explaining', () => {
    expect(campaignRoleLabel('benchmark')).toBe('Benchmark');
    expect(campaignRoleLabel('retest')).toBe('Retest');
    expect(campaignRoleLabel('deload')).toBe('Easy day');
  });

  it('says nothing about an ordinary session', () => {
    expect(campaignRoleLabel('build')).toBeNull();
    expect(campaignRoleDescription('build')).toBeNull();
  });

  it('explains what each labelled session is for', () => {
    expect(campaignRoleDescription('benchmark')).toContain('again at the end');
    expect(campaignRoleDescription('retest')).toContain('week one');
    expect(campaignRoleDescription('deload')).toContain('light');
  });
});
