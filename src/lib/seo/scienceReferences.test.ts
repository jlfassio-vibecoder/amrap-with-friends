import { describe, it, expect } from 'vitest';
import { SCIENCE_REFERENCES, referencesFor } from '@/lib/seo/scienceReferences';

describe('SCIENCE_REFERENCES', () => {
  const all = Object.values(SCIENCE_REFERENCES);

  it('keys every entry by its own id, so a citation marker cannot point at the wrong paper', () => {
    for (const [key, reference] of Object.entries(SCIENCE_REFERENCES)) {
      expect(reference.id, key).toBe(key);
    }
  });

  it('gives every reference a resolvable link', () => {
    for (const reference of all) {
      expect(reference.url, reference.id).toMatch(/^https:\/\//);
    }
  });

  it('prefers a DOI wherever the paper has one', () => {
    // Only the pilot study in a journal without DOIs is exempt.
    const withoutDoi = all.filter((reference) => !reference.url.includes('doi.org'));
    expect(withoutDoi.map((reference) => reference.id)).toEqual(['kliszczewicz2014']);
  });

  it('carries authors, year, title and source for every entry', () => {
    for (const reference of all) {
      expect(reference.authors.trim(), reference.id).not.toBe('');
      expect(reference.title.trim(), reference.id).not.toBe('');
      expect(reference.source.trim(), reference.id).not.toBe('');
      expect(reference.year, reference.id).toBeGreaterThan(1980);
      expect(reference.year, reference.id).toBeLessThan(2100);
    }
  });

  it('carries a note on each, so a reader can weigh the evidence rather than count it', () => {
    for (const reference of all) {
      expect(reference.note.trim().length, reference.id).toBeGreaterThan(20);
    }
  });
});

describe('referencesFor', () => {
  it('returns references in the order given, which is the numbering on the page', () => {
    const [first, second] = referencesFor(['tibana2018', 'gastin2001']);
    expect(first.id).toBe('tibana2018');
    expect(second.id).toBe('gastin2001');
  });

  it('throws on an unknown id rather than rendering a dangling citation marker', () => {
    expect(() => referencesFor(['nope2099'])).toThrow(/Unknown science reference/);
  });
});
