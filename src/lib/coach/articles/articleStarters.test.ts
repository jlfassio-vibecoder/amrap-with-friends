import { describe, expect, it } from 'vitest';
import {
  ARTICLE_STARTERS,
  initialDraftFromStarter,
  matchStarterToArticles,
  monthlyCadenceCounts,
  nextStartersToWrite,
  stalePublishedArticles,
} from './articleStarters';

describe('ARTICLE_STARTERS', () => {
  it('has twenty-four unique calendar ids and slugs', () => {
    expect(ARTICLE_STARTERS).toHaveLength(24);
    expect(new Set(ARTICLE_STARTERS.map((s) => s.id)).size).toBe(24);
    expect(new Set(ARTICLE_STARTERS.map((s) => s.suggestedSlug)).size).toBe(24);
    expect(ARTICLE_STARTERS[0]?.suggestedSlug).toBe(
      'what-150-amrap-workouts-reveal-about-programming'
    );
  });

  it('marks training-together starters as the wedge', () => {
    const together = ARTICLE_STARTERS.filter((s) => s.categoryId === 'training-together');
    expect(together.length).toBeGreaterThan(0);
    expect(together.every((s) => s.trainingTogetherWedge)).toBe(true);
  });
});

describe('matchStarterToArticles / nextStartersToWrite', () => {
  it('matches by suggested slug regardless of status', () => {
    const matches = matchStarterToArticles(ARTICLE_STARTERS, [
      {
        id: 'a1',
        title: 'Draft',
        slug: ARTICLE_STARTERS[0]!.suggestedSlug,
        status: 'draft',
      },
    ]);
    expect(matches[0]?.article?.id).toBe('a1');
    expect(nextStartersToWrite(matches, 3).map((m) => m.starter.id)).toEqual([2, 3, 4]);
  });
});

describe('stalePublishedArticles', () => {
  it('lists published posts older than three months, oldest first', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const stale = stalePublishedArticles(
      [
        {
          id: '1',
          title: 'Fresh',
          slug: 'fresh',
          status: 'published',
          publishedAt: '2026-08-01T00:00:00.000Z',
          modifiedAt: '2026-08-01T00:00:00.000Z',
        },
        {
          id: '2',
          title: 'Old',
          slug: 'old',
          status: 'published',
          publishedAt: '2026-01-01T00:00:00.000Z',
          modifiedAt: '2026-01-15T00:00:00.000Z',
        },
        {
          id: '3',
          title: 'Draft',
          slug: 'draft',
          status: 'draft',
          publishedAt: null,
          modifiedAt: null,
        },
        {
          id: '4',
          title: 'Older',
          slug: 'older',
          status: 'published',
          publishedAt: '2025-06-01T00:00:00.000Z',
          modifiedAt: null,
        },
      ],
      now,
      3
    );
    expect(stale.map((a) => a.id)).toEqual(['4', '2']);
  });
});

describe('monthlyCadenceCounts', () => {
  it('counts first publishes and meaningful refreshes in the UTC month', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const counts = monthlyCadenceCounts(
      [
        {
          id: '1',
          title: 'New',
          slug: 'new',
          status: 'published',
          publishedAt: '2026-09-01T00:00:00.000Z',
          modifiedAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: '2',
          title: 'Refreshed',
          slug: 'refreshed',
          status: 'published',
          publishedAt: '2026-01-01T00:00:00.000Z',
          modifiedAt: '2026-09-02T00:00:00.000Z',
        },
        {
          id: '3',
          title: 'Old',
          slug: 'old',
          status: 'published',
          publishedAt: '2026-08-01T00:00:00.000Z',
          modifiedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      now
    );
    expect(counts).toEqual({ publishedThisMonth: 1, refreshesThisMonth: 1 });
  });
});

describe('initialDraftFromStarter', () => {
  it('prefills Justin Fassio and taxonomy ids', () => {
    const draft = initialDraftFromStarter(ARTICLE_STARTERS[2]!);
    expect(draft.authorDisplayName).toBe('Justin Fassio');
    expect(draft.category).toBe('training-together');
    expect(draft.archetype).toBe('specific-scenario');
    expect(draft.slug).toBe(ARTICLE_STARTERS[2]!.suggestedSlug);
  });
});
