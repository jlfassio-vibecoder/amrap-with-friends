import { isArticleArchetypeId, isArticleCategoryId } from './taxonomy';
import { isArticlePillarPath } from './pillarPaths';
import { isValidArticleSlug } from './slugify';

export type ArticleDraftFields = {
  title: string;
  slug: string;
  category: string;
  archetype: string;
  answerFirst: string;
  description: string;
  authorDisplayName: string;
  pillarPath: string;
  cannibalisationNote: string;
  libraryLinks: string[];
};

export type ArticleValidationIssue = {
  field: keyof ArticleDraftFields | 'bodyMarkdown';
  message: string;
};

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Soft checks for Mark ready — warnings only; hard gate is title + slug. */
export function softValidateArticle(fields: ArticleDraftFields): ArticleValidationIssue[] {
  const issues: ArticleValidationIssue[] = [];

  if (!fields.title.trim()) {
    issues.push({ field: 'title', message: 'Title is required.' });
  }
  if (!fields.slug.trim()) {
    issues.push({ field: 'slug', message: 'Slug is required.' });
  } else if (!isValidArticleSlug(fields.slug.trim())) {
    issues.push({ field: 'slug', message: 'Slug must be lowercase kebab-case.' });
  }

  if (!isArticleCategoryId(fields.category)) {
    issues.push({ field: 'category', message: 'Pick a category.' });
  }
  if (!isArticleArchetypeId(fields.archetype)) {
    issues.push({ field: 'archetype', message: 'Pick an archetype.' });
  }

  const answerWords = wordCount(fields.answerFirst);
  if (answerWords < 40 || answerWords > 60) {
    issues.push({
      field: 'answerFirst',
      message: `Answer-first should be about 40–60 words (currently ${answerWords}).`,
    });
  }

  const descLen = fields.description.trim().length;
  if (descLen < 50 || descLen > 160) {
    issues.push({
      field: 'description',
      message: `Meta description should be 50–160 characters (currently ${descLen}).`,
    });
  }

  if (!fields.authorDisplayName.trim()) {
    issues.push({ field: 'authorDisplayName', message: 'Author display name is required.' });
  }

  if (!fields.pillarPath.trim() || !isArticlePillarPath(fields.pillarPath.trim())) {
    issues.push({ field: 'pillarPath', message: 'Pick a pillar path from the allowlist.' });
  }

  if (!fields.cannibalisationNote.trim()) {
    issues.push({
      field: 'cannibalisationNote',
      message: 'Say why this is a post, not a page edit.',
    });
  }

  const links = fields.libraryLinks.map((l) => l.trim()).filter(Boolean);
  if (links.length < 2) {
    issues.push({
      field: 'libraryLinks',
      message: 'Add at least two library links (workouts or exercises).',
    });
  }

  return issues;
}
