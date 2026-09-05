import type { CoachArticle, CoachArticlePhoto } from '@/lib/api/coachArticles';
import { getCoachArticleMediaUrl } from '@/lib/media/coachArticleMedia';
import type { ArticlePhotoUrlResolver } from './serializeFrontmatter';

export type ArticleExportSnapshot = {
  title: string;
  slug: string;
  category: string;
  archetype: string;
  answerFirst: string;
  description: string;
  author: string;
  pillar: string;
  libraryLinks: string[];
  relatedPosts: string[];
  photos: Array<{ src: string; alt: string; caption?: string }>;
  publishedAt: string;
  modifiedAt: string;
  body: string;
};

export type BuildArticleExportSnapshotInput = {
  title: string;
  slug: string;
  category: string;
  archetype: string;
  answerFirst: string;
  description: string;
  authorDisplayName: string;
  pillarPath: string;
  libraryLinks: string[];
  relatedPostSlugs: string[];
  photos: CoachArticlePhoto[];
  bodyMarkdown: string;
  /** Existing first-publish timestamp when re-publishing. */
  publishedAt: string | null;
  nowIso?: string;
  resolvePhotoUrl?: ArticlePhotoUrlResolver;
};

/** Build the immutable export snapshot stored on publish and pulled into Astro MD. */
export function buildArticleExportSnapshot(
  input: BuildArticleExportSnapshotInput
): ArticleExportSnapshot {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const resolvePhotoUrl = input.resolvePhotoUrl ?? getCoachArticleMediaUrl;

  const photos = input.photos
    .map((photo) => {
      const path = photo.path.trim();
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
    libraryLinks: input.libraryLinks.map((l) => l.trim()).filter(Boolean),
    relatedPosts: input.relatedPostSlugs.map((s) => s.trim()).filter(Boolean),
    photos,
    publishedAt: input.publishedAt?.trim() || nowIso,
    modifiedAt: nowIso,
    body: input.bodyMarkdown,
  };
}

export function buildArticleExportSnapshotFromArticle(
  article: CoachArticle,
  options?: { nowIso?: string; resolvePhotoUrl?: ArticlePhotoUrlResolver }
): ArticleExportSnapshot {
  return buildArticleExportSnapshot({
    title: article.title,
    slug: article.slug,
    category: article.category,
    archetype: article.archetype,
    answerFirst: article.answerFirst,
    description: article.description,
    authorDisplayName: article.authorDisplayName,
    pillarPath: article.pillarPath,
    libraryLinks: article.libraryLinks,
    relatedPostSlugs: article.relatedPostSlugs,
    photos: article.photos,
    bodyMarkdown: article.bodyMarkdown,
    publishedAt: article.publishedAt,
    nowIso: options?.nowIso,
    resolvePhotoUrl: options?.resolvePhotoUrl,
  });
}
