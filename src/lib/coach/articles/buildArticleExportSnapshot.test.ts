import { describe, expect, it } from 'vitest';
import {
  buildArticleExportSnapshot,
  buildArticleExportSnapshotFromArticle,
} from './buildArticleExportSnapshot';
import type { CoachArticle } from '@/lib/api/coachArticles';

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

describe('modifiedAt', () => {
  const photos = [{ path: 'a/b.jpg', alt: 'Alt text' }];
  const base = {
    title: 'A post',
    slug: 'a-post',
    category: 'programming',
    archetype: 'scenario',
    answerFirst: 'An answer.',
    description: 'A description.',
    authorDisplayName: 'Justin Fassio',
    pillarPath: '/amrap-workouts',
    libraryLinks: ['/exercises/burpees', '/amrap-workouts/5-minute'],
    relatedPostSlugs: [],
    photos,
    bodyMarkdown: '## Heading\n\nBody.',
    resolvePhotoUrl: (path: string) => `https://media.test/${path}`,
  };

  const first = buildArticleExportSnapshot({
    ...base,
    publishedAt: null,
    nowIso: '2026-09-01T10:00:00.000Z',
  });

  it('equals publishedAt on a first publish, so no Updated line is shown', () => {
    expect(first.publishedAt).toBe('2026-09-01T10:00:00.000Z');
    expect(first.modifiedAt).toBe(first.publishedAt);
  });

  it('does not advance when a re-publish changes nothing', () => {
    const republished = buildArticleExportSnapshot({
      ...base,
      publishedAt: first.publishedAt,
      previousSnapshot: first as unknown as Record<string, unknown>,
      previousModifiedAt: first.modifiedAt,
      nowIso: '2026-10-05T09:00:00.000Z',
    });
    expect(republished.modifiedAt).toBe(first.modifiedAt);
    expect(republished.publishedAt).toBe(first.publishedAt);
  });

  it('advances when the body changes', () => {
    const edited = buildArticleExportSnapshot({
      ...base,
      bodyMarkdown: '## Heading\n\nA materially different body.',
      publishedAt: first.publishedAt,
      previousSnapshot: first as unknown as Record<string, unknown>,
      previousModifiedAt: first.modifiedAt,
      nowIso: '2026-10-05T09:00:00.000Z',
    });
    expect(edited.modifiedAt).toBe('2026-10-05T09:00:00.000Z');
  });

  it.each([
    ['title', { title: 'A different post' }],
    ['description', { description: 'A different description.' }],
    ['answer-first', { answerFirst: 'A different answer.' }],
    ['author', { authorDisplayName: 'Guest Coach' }],
    ['pillar', { pillarPath: '/exercises' }],
    ['library links', { libraryLinks: ['/exercises/burpees'] }],
    ['related posts', { relatedPostSlugs: ['another-post'] }],
    ['photo alt text', { photos: [{ path: 'a/b.jpg', alt: 'Different alt' }] }],
  ])('advances when the %s changes', (_label, override) => {
    const changed = buildArticleExportSnapshot({
      ...base,
      ...override,
      publishedAt: first.publishedAt,
      previousSnapshot: first as unknown as Record<string, unknown>,
      previousModifiedAt: first.modifiedAt,
      nowIso: '2026-10-05T09:00:00.000Z',
    });
    expect(changed.modifiedAt).toBe('2026-10-05T09:00:00.000Z');
  });

  it('advances when the previous snapshot cannot be read', () => {
    // Bumping unnecessarily is a smaller error than withholding a real update.
    const changed = buildArticleExportSnapshot({
      ...base,
      publishedAt: first.publishedAt,
      previousSnapshot: { nonsense: true },
      previousModifiedAt: first.modifiedAt,
      nowIso: '2026-10-05T09:00:00.000Z',
    });
    expect(changed.modifiedAt).toBe('2026-10-05T09:00:00.000Z');
  });

  it('advances when there is no stored modifiedAt to keep', () => {
    const changed = buildArticleExportSnapshot({
      ...base,
      publishedAt: first.publishedAt,
      previousSnapshot: first as unknown as Record<string, unknown>,
      previousModifiedAt: null,
      nowIso: '2026-10-05T09:00:00.000Z',
    });
    expect(changed.modifiedAt).toBe('2026-10-05T09:00:00.000Z');
  });
});

describe('buildArticleExportSnapshotFromArticle modifiedAt chain', () => {
  const resolvePhotoUrl = (path: string) => `https://media.test/${path}`;

  function articleWith(
    snapshot: Record<string, unknown> | null,
    columnModifiedAt: string | null
  ): CoachArticle {
    return {
      id: 'article-1',
      title: 'A post',
      slug: 'a-post',
      category: 'programming',
      archetype: 'scenario',
      answerFirst: 'An answer.',
      description: 'A description.',
      authorDisplayName: 'Justin Fassio',
      pillarPath: '/amrap-workouts',
      cannibalisationNote: 'Too specific for the collection page.',
      libraryLinks: ['/exercises/burpees', '/amrap-workouts/5-minute'],
      relatedPostSlugs: [],
      photos: [{ path: 'a/b.jpg', alt: 'Alt text' }],
      bodyMarkdown: '## Heading\n\nBody.',
      status: 'published',
      publishedAt: '2026-09-01T10:00:00.000Z',
      modifiedAt: columnModifiedAt,
      exportSnapshot: snapshot,
      updatedAt: '2026-09-01T10:00:00.000Z',
    } as unknown as CoachArticle;
  }

  it('does not walk the date forward across repeated no-op republishes', () => {
    // The `modified_at` column records when a publish ran, so a chain that read
    // it would advance one publish at a time even with nothing edited. The
    // column values here are what the old unconditional `now()` would leave.
    const first = buildArticleExportSnapshotFromArticle(articleWith(null, null), {
      nowIso: '2026-09-01T10:00:00.000Z',
      resolvePhotoUrl,
    });
    expect(first.modifiedAt).toBe('2026-09-01T10:00:00.000Z');

    const second = buildArticleExportSnapshotFromArticle(
      articleWith(first as unknown as Record<string, unknown>, '2026-10-01T00:00:00.000Z'),
      { nowIso: '2026-10-01T00:00:00.000Z', resolvePhotoUrl }
    );
    expect(second.modifiedAt).toBe('2026-09-01T10:00:00.000Z');

    const third = buildArticleExportSnapshotFromArticle(
      articleWith(second as unknown as Record<string, unknown>, '2026-11-01T00:00:00.000Z'),
      { nowIso: '2026-11-01T00:00:00.000Z', resolvePhotoUrl }
    );
    expect(third.modifiedAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('still advances on a real edit after no-op republishes', () => {
    const published = buildArticleExportSnapshotFromArticle(articleWith(null, null), {
      nowIso: '2026-09-01T10:00:00.000Z',
      resolvePhotoUrl,
    });
    const edited = articleWith(
      published as unknown as Record<string, unknown>,
      '2026-11-01T00:00:00.000Z'
    );
    edited.bodyMarkdown = '## Heading\n\nRewritten body.';

    const next = buildArticleExportSnapshotFromArticle(edited, {
      nowIso: '2026-11-02T00:00:00.000Z',
      resolvePhotoUrl,
    });
    expect(next.modifiedAt).toBe('2026-11-02T00:00:00.000Z');
  });
});
