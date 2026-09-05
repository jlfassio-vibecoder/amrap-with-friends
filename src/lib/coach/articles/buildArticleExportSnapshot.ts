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
  /**
   * The snapshot stored by the last publish, when there was one. Compared
   * against the new snapshot so `modifiedAt` only advances on a real change.
   */
  previousSnapshot?: Record<string, unknown> | null;
  /** `modifiedAt` from the last publish, kept when nothing changed. */
  previousModifiedAt?: string | null;
  nowIso?: string;
  resolvePhotoUrl?: ArticlePhotoUrlResolver;
};

/** The content fields a reader sees. Excludes both timestamps by construction. */
type ArticleSnapshotContent = Omit<ArticleExportSnapshot, 'publishedAt' | 'modifiedAt'>;

/**
 * Everything about a snapshot except when it was published or changed.
 *
 * `dateModified` is what a search engine's freshness signal reads, so a
 * re-publish that changed nothing must not claim the article was updated — if
 * every republish bumps the date, the date stops meaning anything and the page
 * shows an "Updated" line that is not true.
 */
export function articleContentFingerprint(snapshot: ArticleSnapshotContent): string {
  return JSON.stringify([
    snapshot.title,
    snapshot.slug,
    snapshot.category,
    snapshot.archetype,
    snapshot.answerFirst,
    snapshot.description,
    snapshot.author,
    snapshot.pillar,
    snapshot.libraryLinks,
    snapshot.relatedPosts,
    snapshot.photos.map((photo) => [photo.src, photo.alt, photo.caption ?? '']),
    snapshot.body,
  ]);
}

/**
 * True when the previous publish is readable and identical to this one.
 *
 * A previous snapshot we cannot parse counts as different: bumping the date
 * unnecessarily is a smaller error than silently withholding a real update.
 */
function contentUnchanged(
  next: ArticleSnapshotContent,
  previous: Record<string, unknown> | null | undefined
): boolean {
  if (!previous) {
    return false;
  }
  try {
    return (
      articleContentFingerprint(previous as unknown as ArticleSnapshotContent) ===
      articleContentFingerprint(next)
    );
  } catch {
    return false;
  }
}

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

  const content: ArticleSnapshotContent = {
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
    body: input.bodyMarkdown,
  };

  const publishedAt = input.publishedAt?.trim() || nowIso;
  const previousModifiedAt = input.previousModifiedAt?.trim();
  const modifiedAt =
    contentUnchanged(content, input.previousSnapshot) && previousModifiedAt
      ? previousModifiedAt
      : nowIso;

  return { ...content, publishedAt, modifiedAt };
}

function readSnapshotModifiedAt(snapshot: Record<string, unknown> | null): string | null {
  const value = snapshot?.modifiedAt;
  return typeof value === 'string' && value.trim() ? value : null;
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
    previousSnapshot: article.exportSnapshot,
    // From the previous snapshot, not the `modifiedAt` column: the column
    // records when a publish last ran, so reading it here would let a chain of
    // no-op republishes walk the date forward one publish at a time.
    previousModifiedAt: readSnapshotModifiedAt(article.exportSnapshot),
    nowIso: options?.nowIso,
    resolvePhotoUrl: options?.resolvePhotoUrl,
  });
}
