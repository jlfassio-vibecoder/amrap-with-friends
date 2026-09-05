import { describe, expect, it } from 'vitest';
import { buildArticleExportSnapshot } from './buildArticleExportSnapshot';

describe('buildArticleExportSnapshot', () => {
  it('builds public photo URLs and ISO dates', () => {
    const snap = buildArticleExportSnapshot({
      title: ' Title ',
      slug: 'My-Slug',
      category: 'programming',
      archetype: 'data-story',
      answerFirst: 'Answer',
      description: 'Desc',
      authorDisplayName: 'Coach',
      pillarPath: '/guides',
      libraryLinks: ['/a', ''],
      relatedPostSlugs: ['other'],
      photos: [{ path: 'u/a/p.jpg', alt: 'Alt', caption: 'Cap' }],
      bodyMarkdown: '# Body',
      publishedAt: null,
      nowIso: '2026-09-05T12:00:00.000Z',
      resolvePhotoUrl: (path) => `https://cdn.test/${path}`,
    });

    expect(snap).toEqual({
      title: 'Title',
      slug: 'my-slug',
      category: 'programming',
      archetype: 'data-story',
      answerFirst: 'Answer',
      description: 'Desc',
      author: 'Coach',
      pillar: '/guides',
      libraryLinks: ['/a'],
      relatedPosts: ['other'],
      photos: [{ src: 'https://cdn.test/u/a/p.jpg', alt: 'Alt', caption: 'Cap' }],
      publishedAt: '2026-09-05T12:00:00.000Z',
      modifiedAt: '2026-09-05T12:00:00.000Z',
      body: '# Body',
    });
  });

  it('keeps an existing publishedAt on refresh', () => {
    const snap = buildArticleExportSnapshot({
      title: 'T',
      slug: 't',
      category: 'programming',
      archetype: 'data-story',
      answerFirst: 'A',
      description: 'D',
      authorDisplayName: 'C',
      pillarPath: '/guides',
      libraryLinks: [],
      relatedPostSlugs: [],
      photos: [],
      bodyMarkdown: '',
      publishedAt: '2026-01-01T00:00:00.000Z',
      nowIso: '2026-09-05T12:00:00.000Z',
      resolvePhotoUrl: (p) => p,
    });
    expect(snap.publishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(snap.modifiedAt).toBe('2026-09-05T12:00:00.000Z');
  });
});
