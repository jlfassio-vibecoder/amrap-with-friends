export const ARTICLE_CATEGORIES = [
  { id: 'programming', label: 'Programming' },
  { id: 'movement', label: 'Movement' },
  { id: 'pacing-scoring', label: 'Pacing & scoring' },
  { id: 'training-together', label: 'Training together' },
  { id: 'the-data', label: 'The data' },
] as const;

export const ARTICLE_ARCHETYPES = [
  { id: 'data-story', label: 'Data story' },
  { id: 'specific-scenario', label: 'Specific scenario' },
  { id: 'seasonal-timely', label: 'Seasonal / timely' },
  { id: 'opinion-pov', label: 'Opinion / POV' },
  { id: 'teardown', label: 'Teardown' },
] as const;

export type ArticleCategoryId = (typeof ARTICLE_CATEGORIES)[number]['id'];
export type ArticleArchetypeId = (typeof ARTICLE_ARCHETYPES)[number]['id'];

export const ARTICLE_CATEGORY_IDS: ArticleCategoryId[] = ARTICLE_CATEGORIES.map((c) => c.id);
export const ARTICLE_ARCHETYPE_IDS: ArticleArchetypeId[] = ARTICLE_ARCHETYPES.map((a) => a.id);

export function isArticleCategoryId(value: string): value is ArticleCategoryId {
  return (ARTICLE_CATEGORY_IDS as string[]).includes(value);
}

export function isArticleArchetypeId(value: string): value is ArticleArchetypeId {
  return (ARTICLE_ARCHETYPE_IDS as string[]).includes(value);
}
