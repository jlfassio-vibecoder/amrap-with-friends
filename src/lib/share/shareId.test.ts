import { describe, expect, it } from 'vitest';
import { SHARE_ID_PATTERN, createShareId, shareDeepLink, shareUrl } from '@/lib/share/shareId';

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
  it('prints the per-share link now that /s/:id is served', () => {
    expect(shareUrl('abc12345')).toBe('amrapwithfriends.com/s/abc12345');
  });
});

describe('shareDeepLink', () => {
  it('keeps the phase 3 shape ready', () => {
    expect(shareDeepLink('abc12345')).toBe('amrapwithfriends.com/s/abc12345');
  });
});
