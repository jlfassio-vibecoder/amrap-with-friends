import { describe, expect, it } from 'vitest';
import { softValidateArticle } from './validateArticle';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const base = {
  title: 'Why easy days matter',
  slug: 'why-easy-days-matter',
  category: 'programming',
  archetype: 'opinion-pov',
  answerFirst: words(50),
  description: 'A'.repeat(80),
  authorDisplayName: 'Coach',
  pillarPath: '/guides',
  cannibalisationNote: 'This is a timely take, not a guide rewrite.',
  libraryLinks: ['/exercises/push-up', '/amrap-workouts/10/first-contact'],
};

describe('softValidateArticle', () => {
  it('returns no issues for a complete draft', () => {
    expect(softValidateArticle(base)).toEqual([]);
  });

  it('flags answer-first outside the 40–60 word band', () => {
    const issues = softValidateArticle({ ...base, answerFirst: words(20) });
    expect(issues.some((i) => i.field === 'answerFirst')).toBe(true);
  });

  it('flags missing category and thin library links', () => {
    const issues = softValidateArticle({
      ...base,
      category: '',
      libraryLinks: ['/exercises/push-up'],
    });
    expect(issues.some((i) => i.field === 'category')).toBe(true);
    expect(issues.some((i) => i.field === 'libraryLinks')).toBe(true);
  });

  it('flags description length', () => {
    const issues = softValidateArticle({ ...base, description: 'short' });
    expect(issues.some((i) => i.field === 'description')).toBe(true);
  });
});
