import { describe, expect, it } from 'vitest';
import { campaignBenchmarkSlots } from '@/lib/benchmark/campaignBenchmarkSlots';
import { canDesignateBenchmark } from '@/lib/benchmark/benchmarkCap';

/** An 8-week schedule that opens and closes on the same workout: a real test. */
function testingSchedule(benchmarkId: string, fillerId: string, durationMinutes = 10) {
  const schedule = [];
  for (let week = 1; week <= 8; week += 1) {
    schedule.push({
      weekNumber: week,
      templateId: week === 1 ? benchmarkId : fillerId,
      durationMinutes,
    });
  }
  schedule[schedule.length - 1] = { weekNumber: 8, templateId: benchmarkId, durationMinutes };
  return schedule;
}

describe('campaignBenchmarkSlots', () => {
  it('holds the domain its benchmark tests in', () => {
    const slots = campaignBenchmarkSlots([
      {
        name: '8-week Blood Shunt',
        status: 'active',
        schedule: testingSchedule('the-hemodynamic', 'the-valve', 10),
      },
    ]);

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      domain: 10,
      source: 'campaign',
      templateId: 'the-hemodynamic',
      campaignName: '8-week Blood Shunt',
    });
  });

  it('leaves the athlete two personal slots, not three', () => {
    const slots = campaignBenchmarkSlots([
      {
        name: '8-week Blood Shunt',
        status: 'active',
        schedule: testingSchedule('the-hemodynamic', 'the-valve', 10),
      },
    ]);

    // The campaign's own domain is closed to a personal designation…
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 10, slots })).toMatchObject({
      ok: false,
      reason: 'domain-taken-campaign',
    });
    // …and the third slot goes once two personal ones are taken.
    const full = [
      ...slots,
      { domain: 5 as const, source: 'personal' as const, templateId: 'flash-flood' },
      { domain: 15 as const, source: 'personal' as const, templateId: 'the-equalizer' },
    ];
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 20, slots: full })).toMatchObject({
      reason: 'at-limit',
    });
  });

  it('releases the slot once the campaign is over', () => {
    // The terminal statuses campaignLifecycle actually recognises — ran out, or
    // ended early. Anything else is still testing someone.
    for (const status of ['complete', 'abandoned']) {
      expect(
        campaignBenchmarkSlots([
          {
            name: 'done',
            status,
            schedule: testingSchedule('the-hemodynamic', 'the-valve', 10),
          },
        ])
      ).toEqual([]);
    }
  });

  it('holds nothing for a rotation that never repeats its opener', () => {
    // deriveCampaignRoles refuses to invent a test here, and so does this.
    expect(
      campaignBenchmarkSlots([
        {
          name: 'flat rotation',
          status: 'active',
          schedule: [
            { weekNumber: 1, templateId: 'the-hemodynamic', durationMinutes: 10 },
            { weekNumber: 2, templateId: 'the-valve', durationMinutes: 10 },
            { weekNumber: 3, templateId: 'equilibrium', durationMinutes: 10 },
          ],
        },
      ])
    ).toEqual([]);
  });

  it('holds nothing when the campaign clock falls between domains', () => {
    expect(
      campaignBenchmarkSlots([
        {
          name: 'odd clock',
          status: 'active',
          schedule: testingSchedule('the-hemodynamic', 'the-valve', 11),
        },
      ])
    ).toEqual([]);
  });

  it('holds one slot per live campaign', () => {
    const slots = campaignBenchmarkSlots([
      {
        name: 'ten',
        status: 'active',
        schedule: testingSchedule('the-hemodynamic', 'the-valve', 10),
      },
      {
        name: 'twenty',
        status: 'active',
        schedule: testingSchedule('the-pacer', 'the-stronghold', 20),
      },
    ]);

    expect(slots.map((slot) => slot.domain)).toEqual([10, 20]);
  });

  it('keeps holding the slot while the campaign is still running', () => {
    for (const status of ['active', 'scheduled']) {
      expect(
        campaignBenchmarkSlots([
          {
            name: 'live',
            status,
            schedule: testingSchedule('the-hemodynamic', 'the-valve', 10),
          },
        ])
      ).toHaveLength(1);
    }
  });

  it('is empty for an athlete in no campaigns', () => {
    expect(campaignBenchmarkSlots([])).toEqual([]);
  });
});
