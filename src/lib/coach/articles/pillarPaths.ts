import { CONTENT_ROUTES } from '@/lib/seo/routes';

/**
 * Indexable content pillars a post may link "up" to, plus `/create` from the
 * blog strategy (product CTA).
 */
export function articlePillarPaths(): string[] {
  const fromContent = CONTENT_ROUTES.filter((route) => route.index).map((route) => route.path);
  const withCreate = fromContent.includes('/create') ? fromContent : [...fromContent, '/create'];
  return [...new Set(withCreate)].sort();
}

export function isArticlePillarPath(path: string): boolean {
  return articlePillarPaths().includes(path);
}
