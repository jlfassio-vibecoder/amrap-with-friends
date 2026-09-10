import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendContentEvent } = vi.hoisted(() => ({ sendContentEvent: vi.fn() }));
vi.mock('@/lib/analytics/contentBeacon', () => ({ sendContentEvent }));

import {
  DEFAULT_SPLITS,
  isOwnInput,
  reportPacingCtaClicked,
  reportPacingScored,
  shouldReportPacingScore,
} from '@/lib/analytics/pacingCalculatorEvents';

describe('isOwnInput', () => {
  it('does not count the prefilled example as engagement', () => {
    // The field is prefilled and scores on load, so without this every
    // pageview would look like someone checking their pacing.
    expect(isOwnInput(DEFAULT_SPLITS)).toBe(false);
    expect(isOwnInput(`  ${DEFAULT_SPLITS}  `)).toBe(false);
  });

  it('ignores whitespace and comma differences in the example', () => {
    expect(isOwnInput('1:08, 1:12, 1:19, 1:14, 1:31')).toBe(false);
  });

  it('counts real splits, including a subset of the example', () => {
    expect(isOwnInput('1:04 1:09 1:11')).toBe(true);
    expect(isOwnInput('1:08 1:12')).toBe(true);
  });

  it('does not count an emptied field', () => {
    expect(isOwnInput('')).toBe(false);
    expect(isOwnInput('   ')).toBe(false);
  });
});

describe('shouldReportPacingScore', () => {
  it('reports own splits with a result, once', () => {
    expect(shouldReportPacingScore({ edited: true, hasResult: true, alreadyReported: false })).toBe(
      true
    );
  });

  it('stays quiet for the example, for a resultless input, and after reporting', () => {
    expect(
      shouldReportPacingScore({ edited: false, hasResult: true, alreadyReported: false })
    ).toBe(false);
    expect(
      shouldReportPacingScore({ edited: true, hasResult: false, alreadyReported: false })
    ).toBe(false);
    expect(shouldReportPacingScore({ edited: true, hasResult: true, alreadyReported: true })).toBe(
      false
    );
  });
});

describe('pacing reporting', () => {
  const context = {
    capMinutes: 15,
    roundCount: 4,
    pvi: 18.4,
    classification: 'Elite Pacing',
  };

  beforeEach(() => {
    sendContentEvent.mockReset();
  });

  it('reports the score with the clock it was scored against', () => {
    reportPacingScored(context);
    expect(sendContentEvent).toHaveBeenCalledWith('pacing_calculator_scored', {
      cap_minutes: 15,
      round_count: 4,
      pvi: 18.4,
      classification: 'Elite Pacing',
    });
  });

  it('distinguishes a CTA click after a score from one before', () => {
    reportPacingCtaClicked('scored', context);
    expect(sendContentEvent).toHaveBeenCalledWith('pacing_calculator_cta_clicked', {
      placement: 'scored',
      cap_minutes: 15,
      round_count: 4,
      classification: 'Elite Pacing',
    });
  });
});
