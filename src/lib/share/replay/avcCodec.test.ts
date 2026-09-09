import { describe, expect, it } from 'vitest';
import { avcCandidates, macroblocksFor } from '@/lib/share/replay/avcCodec';

describe('macroblocksFor', () => {
  it('rounds partial macroblocks up, the way H.264 does', () => {
    // 1080 is not a multiple of 16, so the coded height is 1088 — which is
    // what the browser's error message reports, and what the level must hold.
    expect(macroblocksFor(1080, 1920)).toBe(68 * 120);
    expect(macroblocksFor(1088, 1920)).toBe(68 * 120);
  });

  it('handles the square and landscape layouts', () => {
    expect(macroblocksFor(1080, 1080)).toBe(68 * 68);
    expect(macroblocksFor(1080, 608)).toBe(68 * 38);
  });
});

describe('avcCandidates', () => {
  it('never offers a level too small for a 1080x1920 story frame', () => {
    // The shipped bug: avc1.42E01E is level 3.0, whose limit is 1620
    // macroblocks against the 8160 this frame needs.
    const candidates = avcCandidates(1080, 1920);
    expect(candidates).not.toContain('avc1.42e01e');
    expect(candidates.some((codec) => codec.endsWith('1e'))).toBe(false);
    expect(candidates.some((codec) => codec.endsWith('1f'))).toBe(false);
  });

  it('starts at the lowest level that fits, in the most compatible profile', () => {
    // Level 4.0 holds 8192 macroblocks; the frame needs 8160.
    expect(avcCandidates(1080, 1920)[0]).toBe('avc1.42e028');
  });

  it('offers every profile at each usable level', () => {
    const candidates = avcCandidates(1080, 1920);
    expect(candidates.slice(0, 3)).toEqual(['avc1.42e028', 'avc1.4d4028', 'avc1.640028']);
  });

  it('allows lower levels for smaller frames, so a decoder is not asked for more than needed', () => {
    expect(avcCandidates(640, 480)[0]).toBe('avc1.42e01e');
  });

  it('returns nothing for a frame no level can hold', () => {
    expect(avcCandidates(16000, 16000)).toEqual([]);
  });
});
