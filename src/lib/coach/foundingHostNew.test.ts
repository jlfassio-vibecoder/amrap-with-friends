import { describe, expect, it } from 'vitest';
import { hasFoundingHostApplicationInLast7Days } from './foundingHostNew';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

describe('hasFoundingHostApplicationInLast7Days', () => {
  it('is false when there are no events', () => {
    expect(hasFoundingHostApplicationInLast7Days([], NOW)).toBe(false);
  });

  it('is true when an event landed inside the last 7 days', () => {
    expect(
      hasFoundingHostApplicationInLast7Days([{ occurredAt: '2026-09-08T12:00:00.000Z' }], NOW)
    ).toBe(true);
  });

  it('is false when every event is older than 7 days', () => {
    expect(
      hasFoundingHostApplicationInLast7Days([{ occurredAt: '2026-09-02T11:59:59.000Z' }], NOW)
    ).toBe(false);
  });

  it('ignores unparseable timestamps', () => {
    expect(hasFoundingHostApplicationInLast7Days([{ occurredAt: 'not-a-date' }], NOW)).toBe(false);
  });
});
