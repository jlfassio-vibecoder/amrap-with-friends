import { describe, expect, it } from 'vitest';
import {
  campaignProgress,
  defaultCampaignStartDate,
  formatCampaignDate,
  formatCampaignShape,
  formatCampaignSpan,
  formatOccurrenceDate,
  formatSlotLabel,
  groupOccurrencesByWeek,
  suggestedSlots,
} from './campaignPresentation';
import type { CampaignOccurrence } from './types';

function occurrence(sequence: number, weekNumber: number): CampaignOccurrence {
  return {
    sequence,
    weekNumber,
    slotNumber: 1,
    localDate: '2026-10-05',
    localTime: '06:30',
    weekday: 1,
  };
}

describe('formatCampaignDate', () => {
  it('formats a calendar date', () => {
    expect(formatCampaignDate('2026-10-05')).toBe('5 Oct');
  });

  it('reads the date as UTC so a negative offset cannot shift the day', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatCampaignDate('2026-10-05')).toBe('5 Oct');
      expect(formatOccurrenceDate('2026-10-05')).toBe('Mon 5 Oct');
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('formatOccurrenceDate', () => {
  it('prefixes the weekday', () => {
    expect(formatOccurrenceDate('2026-10-05')).toBe('Mon 5 Oct');
    expect(formatOccurrenceDate('2026-10-10')).toBe('Sat 10 Oct');
  });
});

describe('formatCampaignSpan', () => {
  it('renders the span with the closing year', () => {
    expect(formatCampaignSpan('2026-10-05', '2026-11-28')).toBe('5 Oct – 28 Nov 2026');
  });

  it('uses the end year when the campaign crosses new year', () => {
    expect(formatCampaignSpan('2026-12-07', '2027-01-29')).toBe('7 Dec – 29 Jan 2027');
  });
});

describe('formatSlotLabel', () => {
  it('pluralises the day because the slot repeats', () => {
    expect(formatSlotLabel({ weekday: 1, timeLocal: '06:30' })).toBe('Mondays at 06:30');
    expect(formatSlotLabel({ weekday: 0, timeLocal: '09:00' })).toBe('Sundays at 09:00');
  });
});

describe('groupOccurrencesByWeek', () => {
  it('groups and orders weeks and sessions', () => {
    const groups = groupOccurrencesByWeek([
      occurrence(4, 2),
      occurrence(1, 1),
      occurrence(3, 2),
      occurrence(2, 1),
    ]);
    expect(groups.map((group) => group.weekNumber)).toEqual([1, 2]);
    expect(groups[0].occurrences.map((o) => o.sequence)).toEqual([1, 2]);
    expect(groups[1].occurrences.map((o) => o.sequence)).toEqual([3, 4]);
  });

  it('returns nothing for an empty calendar', () => {
    expect(groupOccurrencesByWeek([])).toEqual([]);
  });

  it('does not mutate the input array order', () => {
    const input = [occurrence(2, 1), occurrence(1, 1)];
    groupOccurrencesByWeek(input);
    expect(input.map((o) => o.sequence)).toEqual([2, 1]);
  });
});

describe('campaignProgress', () => {
  it('computes a percentage', () => {
    expect(campaignProgress(6, 24)).toEqual({ done: 6, total: 24, percent: 25 });
  });

  it('returns zeroes rather than NaN for an empty campaign', () => {
    expect(campaignProgress(0, 0)).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('clamps a count that overshoots the total', () => {
    expect(campaignProgress(30, 24)).toEqual({ done: 24, total: 24, percent: 100 });
    expect(campaignProgress(-2, 24).done).toBe(0);
  });
});

describe('defaultCampaignStartDate', () => {
  it('starts tomorrow so the first session is still actionable', () => {
    expect(defaultCampaignStartDate('2026-10-05')).toBe('2026-10-06');
  });

  it('rolls across a month boundary', () => {
    expect(defaultCampaignStartDate('2026-10-31')).toBe('2026-11-01');
  });
});

describe('suggestedSlots', () => {
  it('spreads days across the week rather than bunching them', () => {
    expect(suggestedSlots(3).map((slot) => slot.weekday)).toEqual([1, 3, 5]);
    expect(suggestedSlots(2).map((slot) => slot.weekday)).toEqual([1, 4]);
  });

  it('returns one slot per session and never repeats a weekday', () => {
    for (let count = 1; count <= 5; count += 1) {
      const slots = suggestedSlots(count);
      expect(slots).toHaveLength(count);
      expect(new Set(slots.map((slot) => slot.weekday)).size).toBe(count);
    }
  });

  it('falls back to a trainable pattern for an unexpected count', () => {
    expect(suggestedSlots(9)).toHaveLength(3);
  });

  it('applies the given time to every slot', () => {
    expect(suggestedSlots(3, '06:00').every((slot) => slot.timeLocal === '06:00')).toBe(true);
  });
});

describe('formatCampaignShape', () => {
  it('summarises the campaign in one line', () => {
    expect(formatCampaignShape(8, 3)).toBe('24 sessions · 3 a week · 8 weeks');
  });

  it('does not say "1 a week" ungrammatically', () => {
    expect(formatCampaignShape(4, 1)).toBe('4 sessions · 1 a week · 4 weeks');
  });
});
