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
      status: 'ready',
      body: '# Body',
    });
  });
});
