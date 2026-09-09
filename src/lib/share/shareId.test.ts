import { describe, expect, it } from 'vitest';
import { SHARE_ID_PATTERN, createShareId, shareUrl } from '@/lib/share/shareId';

describe('createShareId', () => {
  it('matches the shape the database constraint enforces', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(createShareId()).toMatch(SHARE_ID_PATTERN);
    }
  });

  it('excludes the characters people misread in a screenshot', () => {
    const ids = Array.from({ length: 500 }, () => createShareId()).join('');
    for (const ambiguous of ['i', 'l', 'o', 'u']) {
      expect(ids).not.toContain(ambiguous);
    }
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createShareId()));
    expect(ids.size).toBe(500);
  });
});

describe('shareUrl', () => {
  it('builds the link printed on the card', () => {
    expect(shareUrl('abc12345')).toBe('amrapwithfriends.com/s/abc12345');
  });
});
