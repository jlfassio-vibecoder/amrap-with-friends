import { describe, expect, it } from 'vitest';
import { isValidArticleSlug, slugifyArticleTitle } from './slugify';

describe('slugifyArticleTitle', () => {
  it('lowercases and kebab-cases', () => {
    expect(slugifyArticleTitle('AMRAP Pacing Tips')).toBe('amrap-pacing-tips');
  });

  it('strips punctuation and collapses hyphens', () => {
    expect(slugifyArticleTitle('  Why "easy day" matters!  ')).toBe('why-easy-day-matters');
  });

  it('strips diacritics', () => {
    expect(slugifyArticleTitle('Café AMRAPs')).toBe('cafe-amraps');
  });
});

describe('isValidArticleSlug', () => {
  it('accepts kebab-case', () => {
    expect(isValidArticleSlug('amrap-pacing-tips')).toBe(true);
  });

  it('rejects uppercase and spaces', () => {
    expect(isValidArticleSlug('AMRAP Tips')).toBe(false);
    expect(isValidArticleSlug('amrap--tips')).toBe(false);
    expect(isValidArticleSlug('')).toBe(false);
  });
});
