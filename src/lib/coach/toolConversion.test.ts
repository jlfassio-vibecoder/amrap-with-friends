import { describe, expect, it } from 'vitest';
import {
  toolCohortLabel,
  toolLiftIsMeaningful,
  toolLiftVsReaders,
  type ToolConversionRow,
} from '@/lib/coach/toolConversion';

function row(cohort: string, overrides: Partial<ToolConversionRow> = {}): ToolConversionRow {
  return {
    cohortOrder: 1,
    cohort,
    browsers: 100,
    ctaClicks: 10,
    signedUp: 5,
    signupRatePct: 5,
    trained: 4,
    completedMission: 3,
    completedRatePct: 3,
    ...overrides,
  };
}

describe('toolLiftVsReaders', () => {
  it('measures against readers in percentage points', () => {
    const rows = [
      row('reader_only', { signupRatePct: 2 }),
      row('timer_completed', { signupRatePct: 21.5 }),
    ];
    // 9x would be an artefact of the 2% baseline; 19.5 points is the finding.
    expect(toolLiftVsReaders(rows, 'timer_completed', 'signupRatePct')).toBe(19.5);
  });

  it('reports a negative lift honestly', () => {
    const rows = [
      row('reader_only', { completedRatePct: 10 }),
      row('pacing_scored', { completedRatePct: 4 }),
    ];
    expect(toolLiftVsReaders(rows, 'pacing_scored', 'completedRatePct')).toBe(-6);
  });

  it('returns null rather than inventing a baseline', () => {
    expect(toolLiftVsReaders([row('timer_started')], 'timer_started', 'signupRatePct')).toBeNull();
  });
});

describe('toolLiftIsMeaningful', () => {
  it('needs both the cohort and the baseline to clear the floor', () => {
    const rows = [row('reader_only', { browsers: 3 }), row('timer_completed')];
    expect(toolLiftIsMeaningful(rows, 'timer_completed')).toBe(false);
  });

  it('accepts once both are large enough', () => {
    const rows = [row('reader_only', { browsers: 20 }), row('timer_completed', { browsers: 20 })];
    expect(toolLiftIsMeaningful(rows, 'timer_completed')).toBe(true);
  });

  it('is false when the cohort is absent entirely', () => {
    expect(toolLiftIsMeaningful([row('reader_only')], 'pacing_scored')).toBe(false);
  });
});

describe('toolCohortLabel', () => {
  it('names each cohort in plain English and passes unknowns through', () => {
    expect(toolCohortLabel('timer_completed')).toBe('Finished a free timer run');
    expect(toolCohortLabel('something_new')).toBe('something_new');
  });
});
