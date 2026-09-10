import { describe, expect, it } from 'vitest';
import { formatMissionStateLabel } from './formatMissionStateLabel';

describe('formatMissionStateLabel', () => {
  it('maps known mission phases to athlete copy', () => {
    expect(formatMissionStateLabel('waiting')).toBe('Waiting');
    expect(formatMissionStateLabel('setup')).toBe('Get ready');
    expect(formatMissionStateLabel('work')).toBe('Live');
    expect(formatMissionStateLabel('finished')).toBe('Finished');
  });

  it('passes unknown states through unchanged', () => {
    expect(formatMissionStateLabel('custom')).toBe('custom');
    expect(formatMissionStateLabel('')).toBe('');
  });
});
