import { describe, expect, it } from 'vitest';
import { shareImagePath } from '@/lib/share/uploadShareImage';

describe('shareImagePath', () => {
  it('names the key from the blob type, not a hardcoded png', () => {
    // The storage policy matches `{shareId}.png|webp` exactly. A webp written
    // to a .png key is a 403 at upload time, and the link keeps the site logo
    // with no error anyone sees.
    expect(shareImagePath('4jppeegd', 'image/webp')).toBe('4jppeegd.webp');
    expect(shareImagePath('4jppeegd', 'image/png')).toBe('4jppeegd.png');
  });

  it('still produces a policy-matching key for a type it does not know', () => {
    expect(shareImagePath('4jppeegd', 'image/gif')).toBe('4jppeegd.png');
  });

  it('defaults to png, as the only caller before webp did', () => {
    expect(shareImagePath('4jppeegd')).toBe('4jppeegd.png');
  });
});
