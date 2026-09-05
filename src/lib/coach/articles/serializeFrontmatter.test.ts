import { describe, expect, it } from 'vitest';
import { serializeArticleFrontmatter } from './serializeFrontmatter';

describe('serializeArticleFrontmatter', () => {
  it('maps draft fields to Astro-shaped keys', () => {
    const result = serializeArticleFrontmatter({
      title: '  Title  ',
      slug: ' Title-Slug ',
      category: 'programming',
      archetype: 'data-story',
      answerFirst: ' Answer ',
      description: ' Meta ',
      authorDisplayName: ' Coach ',
      pillarPath: '/guides',
      cannibalisationNote: ' Note ',
      libraryLinks: [' /a ', '', '/b'],
      relatedPostSlugs: ['other', ''],
      bodyMarkdown: '# Body',
      status: 'ready',
    });

    expect(result).toEqual({
      title: 'Title',
      slug: 'title-slug',
      category: 'programming',
      archetype: 'data-story',
      answerFirst: 'Answer',
      description: 'Meta',
      author: 'Coach',
      pillar: '/guides',
      cannibalisationNote: 'Note',
      libraryLinks: ['/a', '/b'],
      relatedPosts: ['other'],
      photos: [],
      status: 'ready',
      body: '# Body',
    });
  });

  it('resolves photo public URLs via the injector', () => {
    const result = serializeArticleFrontmatter(
      {
        title: 'Title',
        slug: 'slug',
        category: 'programming',
        archetype: 'data-story',
        answerFirst: 'Answer',
        description: 'Meta',
        authorDisplayName: 'Coach',
        pillarPath: '/guides',
        cannibalisationNote: 'Note',
        libraryLinks: ['/a', '/b'],
        relatedPostSlugs: [],
        bodyMarkdown: '',
        status: 'draft',
        photos: [
          { path: 'coach/a/p1.jpg', alt: 'Setup', caption: 'Step 1' },
          { path: 'coach/a/p2.jpg', alt: 'Finish' },
          { path: '', alt: 'Missing path' },
        ],
      },
      (path) => `https://cdn.test/${path}`
    );

    expect(result.photos).toEqual([
      { src: 'https://cdn.test/coach/a/p1.jpg', alt: 'Setup', caption: 'Step 1' },
      { src: 'https://cdn.test/coach/a/p2.jpg', alt: 'Finish' },
    ]);
  });
});
