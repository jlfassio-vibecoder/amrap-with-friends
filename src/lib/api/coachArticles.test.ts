import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCoachArticle,
  fetchCoachArticles,
  mapCoachArticleError,
  setCoachArticleStatus,
  upsertCoachArticle,
} from './coachArticles';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

beforeEach(() => {
  callRpcMock.mockReset();
});

const VALID_ARTICLE = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Why easy days matter',
  slug: 'why-easy-days-matter',
  category: 'programming',
  archetype: 'opinion-pov',
  answerFirst: 'Because fatigue ruins the retest.',
  description: 'A short take on placing easy days before campaign retests.',
  bodyMarkdown: '## Body\n\nMore copy.',
  authorDisplayName: 'Coach',
  status: 'draft',
  pillarPath: '/guides',
  cannibalisationNote: 'Timely opinion, not a guide rewrite.',
  libraryLinks: ['/exercises/push-up', '/amrap-workouts'],
  relatedPostSlugs: [],
  photos: [{ path: 'coach/art/p1.jpg', alt: 'Easy day demo', caption: 'Hold back' }],
  publishedAt: null,
  modifiedAt: null,
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

describe('mapCoachArticleError', () => {
  it('maps auth errors', () => {
    expect(mapCoachArticleError('Authentication required')).toBe(
      'Sign in to manage coach articles.'
    );
    expect(mapCoachArticleError('Not authorized')).toBe('Not authorized.');
  });
});

describe('fetchCoachArticles', () => {
  it('wires filters and parses summaries', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        articles: [
          {
            id: VALID_ARTICLE.id,
            title: VALID_ARTICLE.title,
            slug: VALID_ARTICLE.slug,
            category: VALID_ARTICLE.category,
            archetype: VALID_ARTICLE.archetype,
            status: 'ready',
            updatedAt: VALID_ARTICLE.updatedAt,
          },
          { id: 'bad' },
        ],
      },
      error: null,
    });

    const result = await fetchCoachArticles({ status: 'ready', category: 'programming' });

    expect(callRpcMock).toHaveBeenCalledWith('coach_list_articles', {
      p_status: 'ready',
      p_category: 'programming',
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].status).toBe('ready');
  });

  it('maps authentication errors', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Authentication required' } });

    const result = await fetchCoachArticles({});

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to manage coach articles.');
  });
});

describe('fetchCoachArticle', () => {
  it('parses a full article', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, article: VALID_ARTICLE },
      error: null,
    });

    const result = await fetchCoachArticle(VALID_ARTICLE.id);

    expect(callRpcMock).toHaveBeenCalledWith('coach_get_article', { p_id: VALID_ARTICLE.id });
    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe('why-easy-days-matter');
    expect(result.data?.libraryLinks).toEqual(['/exercises/push-up', '/amrap-workouts']);
    expect(result.data?.photos).toEqual([
      { path: 'coach/art/p1.jpg', alt: 'Easy day demo', caption: 'Hold back' },
    ]);
  });
});

describe('upsertCoachArticle', () => {
  it('wires all params including null id for creation', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, article: VALID_ARTICLE }, error: null });

    const result = await upsertCoachArticle({
      title: VALID_ARTICLE.title,
      slug: VALID_ARTICLE.slug,
      category: VALID_ARTICLE.category,
      archetype: VALID_ARTICLE.archetype,
      answerFirst: VALID_ARTICLE.answerFirst,
      description: VALID_ARTICLE.description,
      bodyMarkdown: VALID_ARTICLE.bodyMarkdown,
      authorDisplayName: VALID_ARTICLE.authorDisplayName,
      pillarPath: VALID_ARTICLE.pillarPath,
      cannibalisationNote: VALID_ARTICLE.cannibalisationNote,
      libraryLinks: VALID_ARTICLE.libraryLinks,
      relatedPostSlugs: [],
      photos: VALID_ARTICLE.photos,
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_upsert_article', {
      p_id: null,
      p_title: VALID_ARTICLE.title,
      p_slug: VALID_ARTICLE.slug,
      p_category: VALID_ARTICLE.category,
      p_archetype: VALID_ARTICLE.archetype,
      p_answer_first: VALID_ARTICLE.answerFirst,
      p_description: VALID_ARTICLE.description,
      p_body_markdown: VALID_ARTICLE.bodyMarkdown,
      p_author_display_name: VALID_ARTICLE.authorDisplayName,
      p_pillar_path: VALID_ARTICLE.pillarPath,
      p_cannibalisation_note: VALID_ARTICLE.cannibalisationNote,
      p_library_links: VALID_ARTICLE.libraryLinks,
      p_related_post_slugs: [],
      p_photos: VALID_ARTICLE.photos,
    });
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(VALID_ARTICLE.id);
  });
});

describe('setCoachArticleStatus', () => {
  it('sets ready', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, article: { ...VALID_ARTICLE, status: 'ready' } },
      error: null,
    });

    const result = await setCoachArticleStatus(VALID_ARTICLE.id, 'ready');

    expect(callRpcMock).toHaveBeenCalledWith('coach_set_article_status', {
      p_id: VALID_ARTICLE.id,
      p_status: 'ready',
    });
    expect(result.data?.status).toBe('ready');
  });
});
