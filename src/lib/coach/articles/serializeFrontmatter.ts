import type { ArticleDraftFields, ArticlePhotoDraft } from './validateArticle';

export type ArticleFrontmatterInput = ArticleDraftFields & {
  bodyMarkdown: string;
  relatedPostSlugs: string[];
  status: string;
  photos?: ArticlePhotoDraft[];
};

export type ArticlePhotoUrlResolver = (path: string) => string;

/**
 * Object shape matching a future Astro content collection entry.
 * Pure — for tests and Phase 4 export. Pass resolvePhotoUrl so tests stay offline.
 */
export function serializeArticleFrontmatter(
  input: ArticleFrontmatterInput,
  resolvePhotoUrl: ArticlePhotoUrlResolver = (path) => path
): Record<string, unknown> {
  const photos = (input.photos ?? [])
    .map((photo) => {
      const path = (photo.path ?? '').trim();
      const alt = photo.alt.trim();
      if (!path || !alt) {
        return null;
      }
      const caption = photo.caption?.trim();
      return caption
        ? { src: resolvePhotoUrl(path), alt, caption }
        : { src: resolvePhotoUrl(path), alt };
    })
    .filter((photo): photo is { src: string; alt: string; caption?: string } => photo !== null);

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
    photos,
    status: input.status,
    body: input.bodyMarkdown,
  };
}
