import { describe, expect, it } from 'vitest';
import { articleQualityGates, hardValidateArticle, softValidateArticle } from './validateArticle';

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

describe('articleQualityGates', () => {
  it('returns no issues for a complete draft', () => {
    expect(articleQualityGates(base)).toEqual([]);
  });

  it('allows zero photos', () => {
    expect(articleQualityGates({ ...base, photos: [] })).toEqual([]);
  });

  it('flags title and slug', () => {
    const issues = articleQualityGates({ ...base, title: '', slug: 'Bad Slug' });
    expect(issues.some((i) => i.field === 'title')).toBe(true);
    expect(issues.some((i) => i.field === 'slug')).toBe(true);
  });

  it('flags category and archetype', () => {
    const issues = articleQualityGates({ ...base, category: '', archetype: '' });
    expect(issues.some((i) => i.field === 'category')).toBe(true);
    expect(issues.some((i) => i.field === 'archetype')).toBe(true);
  });

  it('flags answer-first outside the 40–60 word band', () => {
    const issues = articleQualityGates({ ...base, answerFirst: words(20) });
    expect(issues.some((i) => i.field === 'answerFirst')).toBe(true);
  });

  it('flags description length', () => {
    const issues = articleQualityGates({ ...base, description: 'short' });
    expect(issues.some((i) => i.field === 'description')).toBe(true);
  });

  it('flags missing author', () => {
    const issues = articleQualityGates({ ...base, authorDisplayName: '  ' });
    expect(issues.some((i) => i.field === 'authorDisplayName')).toBe(true);
  });

  it('flags pillar and cannibalisation', () => {
    const issues = articleQualityGates({
      ...base,
      pillarPath: '',
      cannibalisationNote: '',
    });
    expect(issues.some((i) => i.field === 'pillarPath')).toBe(true);
    expect(issues.some((i) => i.field === 'cannibalisationNote')).toBe(true);
  });

  it('flags thin library links', () => {
    const issues = articleQualityGates({
      ...base,
      libraryLinks: ['/exercises/push-up'],
    });
    expect(issues.some((i) => i.field === 'libraryLinks')).toBe(true);
  });

  it('flags photos missing alt text', () => {
    const issues = articleQualityGates({
      ...base,
      photos: [
        { path: 'a/b.jpg', alt: '' },
        { path: 'a/c.jpg', alt: 'Ok' },
      ],
    });
    expect(issues.some((i) => i.field === 'photos')).toBe(true);
  });
});

describe('softValidateArticle / hardValidateArticle', () => {
  it('return the same issues for identical input', () => {
    const incomplete = { ...base, category: '', answerFirst: words(10) };
    expect(softValidateArticle(incomplete)).toEqual(hardValidateArticle(incomplete));
    expect(softValidateArticle(incomplete)).toEqual(articleQualityGates(incomplete));
  });
});
