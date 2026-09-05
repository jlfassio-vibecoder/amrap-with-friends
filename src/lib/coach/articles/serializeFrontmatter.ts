import type { ArticleDraftFields } from './validateArticle';

export type ArticleFrontmatterInput = ArticleDraftFields & {
  bodyMarkdown: string;
  relatedPostSlugs: string[];
  status: string;
};

/**
 * Object shape matching a future Astro content collection entry (minus images).
 * Pure — for tests and Phase 4 export.
 */
export function serializeArticleFrontmatter(
  input: ArticleFrontmatterInput
): Record<string, unknown> {
  return {
    title: input.title.trim(),
    slug: input.slug.trim().toLowerCase(),
    category: input.category.trim(),
    archetype: input.archetype.trim(),
    answerFirst: input.answerFirst.trim(),
    description: input.description.trim(),
    author: input.authorDisplayName.trim(),
    pillar: input.pillarPath.trim(),
    cannibalisationNote: input.cannibalisationNote.trim(),
    libraryLinks: input.libraryLinks.map((l) => l.trim()).filter(Boolean),
    relatedPosts: input.relatedPostSlugs.map((s) => s.trim()).filter(Boolean),
    status: input.status,
    body: input.bodyMarkdown,
  };
}
