import { describe, expect, it } from 'vitest';
import {
  PHOTO_TARGETS,
  chartBandScrim,
  chartBandStops,
  coverRect,
  photoRejectionReason,
  scrimStops,
  slotForLayout,
  slotsForTarget,
} from '@/lib/share/photo';

describe('coverRect', () => {
  it('fills a 9:16 card from a landscape phone photo without distorting it', () => {
    // 4032x3024 (4:3) into 1080x1920. Scale is driven by height; the sides
    // are cropped. The aspect ratio must survive.
    const rect = coverRect(4032, 3024, 1080, 1920);
    expect(rect.height).toBeCloseTo(1920, 5);
    expect(rect.width / rect.height).toBeCloseTo(4032 / 3024, 5);
    expect(rect.width).toBeGreaterThan(1080);
  });

  it('still crops the sides of a portrait phone photo', () => {
    // 3:4 is 0.75; a story card is 0.5625. Even held vertically, a phone
    // photo is wider than the frame, so the sides go — worth knowing before
    // telling anyone to "hold it portrait and it will fit".
    const rect = coverRect(3024, 4032, 1080, 1920);
    expect(rect.height).toBeCloseTo(1920, 5);
    expect(rect.width).toBeGreaterThan(1080);
    expect(rect.width / rect.height).toBeCloseTo(3024 / 4032, 5);
  });

  it('crops top and bottom only for something taller than the card', () => {
    const rect = coverRect(1000, 3000, 1080, 1920);
    expect(rect.width).toBeCloseTo(1080, 5);
    expect(rect.height).toBeGreaterThan(1920);
  });

  it('centres the crop, so a selfie subject stays in frame', () => {
    const rect = coverRect(4032, 3024, 1080, 1920);
    expect(rect.x).toBeCloseTo((1080 - rect.width) / 2, 5);
    expect(rect.y).toBeCloseTo(0, 5);
  });

  it('handles an exact-ratio photo with no crop at all', () => {
    expect(coverRect(1080, 1920, 1080, 1920)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
  });

  it('does not divide by zero on a broken image', () => {
    expect(coverRect(0, 0, 1080, 1920)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
  });
});

describe('photoRejectionReason', () => {
  it('accepts what a phone camera produces, including HEIC', () => {
    expect(photoRejectionReason({ type: 'image/jpeg', size: 4_000_000 })).toBeNull();
    expect(photoRejectionReason({ type: 'image/heic', size: 3_000_000 })).toBeNull();
    expect(photoRejectionReason({ type: 'image/PNG', size: 500_000 })).toBeNull();
  });

  it('rejects a non-image rather than handing it to a canvas', () => {
    expect(photoRejectionReason({ type: 'application/pdf', size: 100 })).toContain('not a photo');
    expect(photoRejectionReason({ type: 'video/mp4', size: 100 })).toContain('not a photo');
  });

  it('rejects something implausibly large', () => {
    expect(photoRejectionReason({ type: 'image/jpeg', size: 60_000_000 })).toContain('too large');
  });
});

describe('scrimStops', () => {
  it('is darkest where the text sits and lightest across the middle', () => {
    // A flat wash would grey the photo out; the type only needs protecting
    // where it actually is.
    const stops = scrimStops();
    const middle = stops.find((stop) => stop.offset === 0.45);
    expect(stops[0]?.alpha).toBeGreaterThan(middle?.alpha ?? 1);
    expect(stops[stops.length - 1]?.alpha).toBeGreaterThan(middle?.alpha ?? 1);
  });

  it('never lets the photo through at full brightness under the type', () => {
    expect(scrimStops().every((stop) => stop.alpha >= 0.6)).toBe(true);
  });
});

describe('the scrim band behind the chart', () => {
  it('fades in and out rather than cutting a hard edge across the photo', () => {
    const stops = chartBandStops();
    expect(stops[0]).toEqual({ offset: 0, alpha: 0 });
    expect(stops.at(-1)).toEqual({ offset: 1, alpha: 0 });
  });

  it('holds full darkness across the middle, where the bars are', () => {
    const { alpha } = chartBandScrim();
    const [, rampIn, rampOut] = chartBandStops();
    expect(rampIn!.alpha).toBe(alpha);
    expect(rampOut!.alpha).toBe(alpha);
    expect(rampOut!.offset).toBeGreaterThan(rampIn!.offset);
  });

  it('is darker than the card-height gradient is at its lightest', () => {
    // The point of the band: the gradient's trough is what let the bars
    // disappear, so a band no darker than that would fix nothing.
    const lightest = Math.min(...scrimStops().map((stop) => stop.alpha));
    expect(chartBandScrim().alpha).toBeGreaterThan(lightest);
  });

  it('clamps a feather that would leave no solid middle', () => {
    const stops = chartBandStops({ alpha: 0.7, feather: 0.9 });
    expect(stops[1]!.offset).toBeLessThanOrEqual(stops[2]!.offset);
  });
});

describe('which photo a card draws from', () => {
  it('gives the wide card its own slot, which is the point', () => {
    // A 3:4 photo centred into 1.78:1 keeps a band out of the middle, so a
    // head-and-shoulders shot arrived on X as a torso.
    expect(slotForLayout('landscape')).toBe('wide');
  });

  it('gives story the portrait slot', () => {
    expect(slotForLayout('story')).toBe('portrait');
  });

  it('gives square the portrait slot, because it crops top and bottom', () => {
    // 1:1 from a 3:4 loses the top and bottom, not the sides, so the face
    // survives -- which is what the split is protecting.
    expect(slotForLayout('square')).toBe('portrait');
  });
});

describe('slotsForTarget', () => {
  it('fills both slots by default, because most athletes have one photo', () => {
    expect(slotsForTarget('both')).toEqual(['portrait', 'wide']);
  });

  it('fills exactly one when the athlete picked one', () => {
    expect(slotsForTarget('portrait')).toEqual(['portrait']);
    expect(slotsForTarget('wide')).toEqual(['wide']);
  });

  it('offers every target the athlete can choose', () => {
    expect(PHOTO_TARGETS).toEqual(['portrait', 'wide', 'both']);
  });
});
