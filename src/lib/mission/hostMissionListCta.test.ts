import { describe, expect, it } from 'vitest';
import { hostMissionListCtaLabel, myMissionListCtaLabel } from './hostMissionListCta';

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

describe('myMissionListCtaLabel', () => {
  it('uses Start only for host waiting/setup', () => {
    expect(myMissionListCtaLabel('waiting', 'host')).toBe('Start this mission');
    expect(myMissionListCtaLabel('setup', 'host')).toBe('Start this mission');
  });

  it('uses Enter for joiners who have not finished', () => {
    expect(myMissionListCtaLabel('waiting', 'joiner')).toBe('Enter mission');
    expect(myMissionListCtaLabel('work', 'joiner')).toBe('Enter mission');
  });

  it('uses View for finished joiners and hosts', () => {
    expect(myMissionListCtaLabel('finished', 'joiner')).toBe('View mission');
    expect(myMissionListCtaLabel('finished', 'host')).toBe('View mission');
  });
});
