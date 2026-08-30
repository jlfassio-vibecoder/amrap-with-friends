import { describe, expect, it } from 'vitest';
import { ogCardFromSex, ogImageAbsoluteUrl, ogImagePath, parseOgCard, withOgCard } from './ogCard';

describe('ogCard', () => {
  it('maps M to m and everything else to f', () => {
    expect(ogCardFromSex('M')).toBe('m');
    expect(ogCardFromSex('F')).toBe('f');
    expect(ogCardFromSex(null)).toBe('f');
    expect(ogCardFromSex(undefined)).toBe('f');
  });

  it('parses card query values', () => {
    expect(parseOgCard('m')).toBe('m');
    expect(parseOgCard('f')).toBe('f');
    expect(parseOgCard('x')).toBe('f');
    expect(parseOgCard(null)).toBe('f');
  });

  it('appends card to absolute URLs', () => {
    expect(withOgCard('https://amrap.example/join?l=abc', 'f')).toBe(
      'https://amrap.example/join?l=abc&card=f'
    );
    expect(withOgCard('https://amrap.example/join?l=abc&card=f', 'm')).toBe(
      'https://amrap.example/join?l=abc&card=m'
    );
  });

  it('builds image paths', () => {
    expect(ogImagePath('f')).toBe('/og-image-f.png');
    expect(ogImageAbsoluteUrl('https://amrapwithfriends.com', 'm')).toBe(
      'https://amrapwithfriends.com/og-image-m.png'
    );
  });
});
