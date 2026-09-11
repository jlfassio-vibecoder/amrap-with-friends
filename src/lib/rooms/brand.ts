import { AWF_THEME, type ShareTheme } from '@/lib/share/renderer/theme';

/**
 * A room's brand, and what it is allowed to change about a share card.
 *
 * One colour, not a palette. The card's background, ink and surface are what
 * make it readable at thumbnail size in a group chat, and every extra colour a
 * coach can set is another way to ship an unreadable card. The accent is the
 * one that carries meaning — the score, the slowest split, the footer rule —
 * so it is the one worth handing over.
 *
 * The second half of the pair is never chosen. `onAccent` is derived by
 * contrast, because the only person who can get it wrong is the coach, and the
 * only people who see it wrong are their athletes.
 */
export interface RoomBrand {
  accent: string;
}

/** WCAG AA for large text. The hero is enormous; the 6px footer rule is not. */
const MIN_CONTRAST = 4.5;

const HEX_SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#?([0-9a-f]{6})$/i;

/** Accepts `#abc`, `abc`, `#aabbcc`, `aabbcc`; always answers lower-case `#rrggbb`. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  const short = HEX_SHORT.exec(trimmed);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  const long = HEX_LONG.exec(trimmed);
  return long ? `#${long[1].toLowerCase()}` : null;
}

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/** sRGB relative luminance, per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(from: string, toward: string, amount: number): string {
  const a = channels(from);
  const b = channels(toward);
  return toHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

/**
 * The nearest version of the coach's colour that can actually be read on the
 * card, found by mixing toward whichever end the background is furthest from.
 *
 * Adjusting rather than rejecting is deliberate. A gym whose colour is navy
 * would otherwise pick their real brand, see the default gold, and conclude the
 * feature is broken — while a rejected colour teaches them nothing about why.
 * Mixing preserves hue, so a navy room still reads as a navy room; it just
 * reads. The dashboard shows the adjusted swatch, so nobody is surprised by
 * what ships.
 */
export function legibleAccent(
  accent: string,
  background: string,
  minContrast: number = MIN_CONTRAST
): string {
  if (contrastRatio(accent, background) >= minContrast) {
    return accent;
  }
  // Toward white on a dark card, toward black on a light one. Chosen from the
  // background rather than assumed, so this stays correct if a light card ever
  // exists.
  const target =
    contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
      ? '#ffffff'
      : '#000000';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(accent, target, step / 20);
    if (contrastRatio(candidate, background) >= minContrast) {
      return candidate;
    }
  }
  return target;
}

/** Whichever of the two card colours can be read on top of the accent. */
export function onAccentFor(accent: string, ink: string, background: string): string {
  return contrastRatio(accent, background) >= contrastRatio(accent, ink) ? background : ink;
}

/** The `rooms.brand` jsonb, validated. Anything unrecognised is no brand at all. */
export function parseRoomBrand(brand: unknown): RoomBrand | null {
  if (typeof brand !== 'object' || brand === null || Array.isArray(brand)) {
    return null;
  }
  const accent = normalizeHex((brand as Record<string, unknown>).accent);
  return accent ? { accent } : null;
}

/**
 * The card theme for a room, or the house theme when the room has no brand.
 *
 * Only the accent pair moves. Background, ink, surface and border are the
 * card's legibility and stay the product's.
 */
export function roomShareTheme(brand: RoomBrand | null, base: ShareTheme = AWF_THEME): ShareTheme {
  if (!brand) {
    return base;
  }
  const accent = legibleAccent(brand.accent, base.background);
  return { ...base, accent, onAccent: onAccentFor(accent, base.ink, base.background) };
}

/**
 * The footer line on a room's card.
 *
 * The room comes first because the card is theirs, and the product stays
 * because the card is the acquisition loop — a coach cannot brand the platform
 * off its own share image. That is a product decision, not an oversight.
 */
export function roomCardMark(handle: string | null | undefined): string {
  const trimmed = (handle ?? '').trim().replace(/^@/, '');
  return trimmed.length > 0 ? `@${trimmed} · AMRAP With Friends` : 'AMRAP With Friends';
}
