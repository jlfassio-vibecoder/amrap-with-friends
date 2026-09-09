import { describe, expect, it } from 'vitest';
import {
  MAX_OG_IMAGE_BYTES,
  OG_IMAGE_TYPE,
  OG_LAYOUT,
  OG_QUALITY_STEPS,
  extensionForType,
  fitsOgLimit,
} from '@/lib/share/ogImage';

describe('the link-preview image', () => {
  it('is the same portrait card the athlete was looking at', () => {
    // It was landscape for a while, chosen to survive a crawler's 1.91:1 crop.
    // That optimised for the crawler and shipped something the athlete never
    // composed: a link that unfurled as a different card from the one in the
    // panel, with their face cropped off the top of their own photo.
    expect(OG_LAYOUT).toBe('story');
  });

  it('is webp, because a photo card as png cannot fit the bucket', () => {
    // Measured: one photo card was 1,302,057 bytes as png against this limit.
    expect(OG_IMAGE_TYPE).toBe('image/webp');
    expect(MAX_OG_IMAGE_BYTES).toBe(409600);
  });

  it('steps quality down rather than softening every card for the worst one', () => {
    expect(OG_QUALITY_STEPS.length).toBeGreaterThan(1);
    const descending = [...OG_QUALITY_STEPS].sort((a, b) => b - a);
    expect(OG_QUALITY_STEPS).toEqual(descending);
    expect(OG_QUALITY_STEPS[0]).toBeGreaterThan(0.8);
  });
});

describe('fitsOgLimit', () => {
  it('accepts a blob at the limit and rejects one past it', () => {
    expect(fitsOgLimit(MAX_OG_IMAGE_BYTES)).toBe(true);
    expect(fitsOgLimit(MAX_OG_IMAGE_BYTES + 1)).toBe(false);
  });

  it('rejects an empty blob, which is an encode that failed rather than a small card', () => {
    expect(fitsOgLimit(0)).toBe(false);
  });
});

describe('extensionForType', () => {
  it('maps the two types the storage policy accepts', () => {
    expect(extensionForType('image/webp')).toBe('webp');
    expect(extensionForType('image/png')).toBe('png');
  });

  it('ignores the codec parameter a canvas may append', () => {
    expect(extensionForType('image/webp;charset=utf-8')).toBe('webp');
  });

  it('refuses anything else rather than guessing an extension the policy rejects', () => {
    // A path the policy will not match is a 403 at upload time; better to
    // never build one.
    expect(extensionForType('image/jpeg')).toBeNull();
    expect(extensionForType('')).toBeNull();
  });
});
