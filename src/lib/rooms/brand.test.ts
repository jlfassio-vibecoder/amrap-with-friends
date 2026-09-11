import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  legibleAccent,
  normalizeHex,
  onAccentFor,
  parseRoomBrand,
  relativeLuminance,
  roomCardMark,
  roomShareTheme,
} from '@/lib/rooms/brand';
import { AWF_THEME } from '@/lib/share/renderer/theme';

describe('normalizeHex', () => {
  it('accepts long and short form, with or without the hash', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex('aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex(' #abc ')).toBe('#aabbcc');
  });

  it('refuses anything that is not a hex colour', () => {
    for (const value of ['red', '#ab', '#abcd', '#gggggg', '', 12, null, undefined, {}]) {
      expect(normalizeHex(value)).toBeNull();
    }
  });
});

describe('contrast', () => {
  it('matches the WCAG anchors', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('legibleAccent', () => {
  it('leaves a colour that already reads alone', () => {
    // The house gold is the case that must not move.
    expect(legibleAccent(AWF_THEME.accent, AWF_THEME.background)).toBe(AWF_THEME.accent);
  });

  it('lifts a colour that would vanish into the card', () => {
    const navy = '#0a0a2a';
    expect(contrastRatio(navy, AWF_THEME.background)).toBeLessThan(4.5);
    const fixed = legibleAccent(navy, AWF_THEME.background);
    expect(contrastRatio(fixed, AWF_THEME.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the hue while lifting it', () => {
    // Still blue-dominant: a navy room reads as a navy room, not as gold.
    const fixed = legibleAccent('#0a0a2a', AWF_THEME.background);
    const b = Number.parseInt(fixed.slice(5, 7), 16);
    const r = Number.parseInt(fixed.slice(1, 3), 16);
    expect(b).toBeGreaterThan(r);
  });

  it('darkens instead of lightening when the card is light', () => {
    const fixed = legibleAccent('#fff6cc', '#ffffff');
    expect(relativeLuminance(fixed)).toBeLessThan(relativeLuminance('#fff6cc'));
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('terminates on a colour identical to the background', () => {
    const fixed = legibleAccent(AWF_THEME.background, AWF_THEME.background);
    expect(contrastRatio(fixed, AWF_THEME.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('onAccentFor', () => {
  it('puts dark type on a bright accent and light type on a dark one', () => {
    expect(onAccentFor('#f7e08a', AWF_THEME.ink, AWF_THEME.background)).toBe(AWF_THEME.background);
    expect(onAccentFor('#1b3a6b', AWF_THEME.ink, AWF_THEME.background)).toBe(AWF_THEME.ink);
  });
});

describe('parseRoomBrand', () => {
  it('reads an accent out of the jsonb', () => {
    expect(parseRoomBrand({ accent: '#1E90FF' })).toEqual({ accent: '#1e90ff' });
  });

  it('answers null for an empty, malformed or non-object brand', () => {
    for (const value of [{}, { accent: 'blue' }, null, [], 'accent', { accent: 12 }]) {
      expect(parseRoomBrand(value)).toBeNull();
    }
  });
});

describe('roomShareTheme', () => {
  it('is the house theme without a brand', () => {
    expect(roomShareTheme(null)).toBe(AWF_THEME);
  });

  it('moves only the accent pair', () => {
    const theme = roomShareTheme({ accent: '#1e90ff' });
    expect(theme.accent).toBe('#1e90ff');
    expect(theme.background).toBe(AWF_THEME.background);
    expect(theme.ink).toBe(AWF_THEME.ink);
    expect(theme.surface).toBe(AWF_THEME.surface);
    expect(theme.border).toBe(AWF_THEME.border);
  });

  it('never hands the renderer an accent the card cannot show', () => {
    const theme = roomShareTheme({ accent: '#100e0b' });
    expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('roomCardMark', () => {
  it('leads with the room and keeps the product', () => {
    expect(roomCardMark('northside')).toBe('@northside · AMRAP With Friends');
    expect(roomCardMark('@northside')).toBe('@northside · AMRAP With Friends');
  });

  it('is the plain watermark off a room mission', () => {
    expect(roomCardMark(null)).toBe('AMRAP With Friends');
    expect(roomCardMark('  ')).toBe('AMRAP With Friends');
  });
});
