import { describe, expect, it } from 'vitest';
import { hostMissionListCtaLabel } from './hostMissionListCta';

describe('hostMissionListCtaLabel', () => {
  it('names Start for waiting and setup', () => {
    expect(hostMissionListCtaLabel('waiting')).toBe('Start this mission');
    expect(hostMissionListCtaLabel('setup')).toBe('Start this mission');
  });

  it('names Enter for live work', () => {
    expect(hostMissionListCtaLabel('work')).toBe('Enter mission');
  });

  it('names View for finished and unknown states', () => {
    expect(hostMissionListCtaLabel('finished')).toBe('View mission');
    expect(hostMissionListCtaLabel('')).toBe('View mission');
    expect(hostMissionListCtaLabel('cancelled')).toBe('View mission');
  });
});
