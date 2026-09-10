import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN } from '@/lib/seo/routes';
import { AUTHOR_ID, AUTHOR_PATH, SITE_AUTHOR, isSiteAuthor } from '@/lib/seo/author';
import { blogPosting, organization, person } from '@/lib/seo/structuredData';

describe('isSiteAuthor', () => {
  it('matches the byline the article builder writes, however it is cased or padded', () => {
    expect(isSiteAuthor('Justin Fassio')).toBe(true);
    expect(isSiteAuthor('  justin fassio  ')).toBe(true);
    expect(isSiteAuthor('JUSTIN FASSIO')).toBe(true);
  });

  it('does not claim a guest author is the site author', () => {
    expect(isSiteAuthor('Someone Else')).toBe(false);
    expect(isSiteAuthor('')).toBe(false);
    expect(isSiteAuthor('Justin')).toBe(false);
  });
});

describe('person', () => {
  const node = person();

  it('is addressable, so a byline can point at it instead of repeating a name', () => {
    expect(node['@id']).toBe(AUTHOR_ID);
    expect(node.url).toBe(`${SITE_ORIGIN}${AUTHOR_PATH}`);
  });

  it('carries the credentials as dated entries', () => {
    expect(node.hasCredential).toEqual([
      {
        '@type': 'EducationalOccupationalCredential',
        name: 'Master Fitness Trainer',
        dateCreated: '1998',
      },
      {
        '@type': 'EducationalOccupationalCredential',
        name: "Commander's Total Fitness Program Manager",
        dateCreated: '1998',
      },
    ]);
  });

  it('omits sameAs entirely while there is nothing to corroborate with', () => {
    // An empty array asserts "this person exists nowhere else", which is a
    // worse claim than making none. Once the real URLs land this flips.
    if (SITE_AUTHOR.sameAs.length === 0) {
      expect('sameAs' in node).toBe(false);
    } else {
      expect(node.sameAs).toEqual([...SITE_AUTHOR.sameAs]);
    }
  });
});

describe('organization', () => {
  it('names the founder, so person and product resolve as one entity', () => {
    expect(organization().founder).toEqual({ '@id': AUTHOR_ID });
  });
});

describe('blogPosting author', () => {
  const base = {
    title: 'A post',
    description: 'A description',
    path: '/blog/a-post',
    datePublished: '2026-09-01',
    dateModified: '2026-09-01',
  };

  it('references the author entity when the byline is ours', () => {
    expect(blogPosting({ ...base, authorName: 'Justin Fassio' }).author).toEqual({
      '@id': AUTHOR_ID,
    });
  });

  it('still inlines a guest byline, so the builder needs no code change for one', () => {
    expect(blogPosting({ ...base, authorName: 'Guest Coach' }).author).toEqual({
      '@type': 'Person',
      name: 'Guest Coach',
    });
  });
});
