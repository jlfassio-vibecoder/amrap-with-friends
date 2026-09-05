import { callRpc } from '@/lib/api/callRpc';

export type CoachArticleApiError = { message: string };

export type CoachArticleStatus = 'draft' | 'ready' | 'published' | 'archived';

export interface CoachArticlePhoto {
  path: string;
  alt: string;
  caption?: string;
}

export interface CoachArticleSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  archetype: string;
  status: CoachArticleStatus;
  publishedAt: string | null;
  modifiedAt: string | null;
  updatedAt: string;
}

export interface CoachArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  archetype: string;
  answerFirst: string;
  description: string;
  bodyMarkdown: string;
  authorDisplayName: string;
  status: CoachArticleStatus;
  pillarPath: string;
  cannibalisationNote: string;
  libraryLinks: string[];
  relatedPostSlugs: string[];
  photos: CoachArticlePhoto[];
  publishedAt: string | null;
  modifiedAt: string | null;
  exportSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCoachArticleInput {
  id?: string;
  title: string;
  slug: string;
  category: string;
  archetype: string;
  answerFirst: string;
  description: string;
  bodyMarkdown: string;
  authorDisplayName: string;
  pillarPath: string;
  cannibalisationNote: string;
  libraryLinks: string[];
  relatedPostSlugs: string[];
  photos?: CoachArticlePhoto[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringAllowEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readStatus(value: unknown): CoachArticleStatus {
  if (value === 'ready' || value === 'published' || value === 'archived') {
    return value;
  }
  return 'draft';
}

function readPhotos(value: unknown): CoachArticlePhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const photos: CoachArticlePhoto[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const path = readString(row.path);
    const alt = readString(row.alt);
    if (!path || !alt) {
      continue;
    }
    const caption = readString(row.caption);
    photos.push(caption ? { path, alt, caption } : { path, alt });
  }
  return photos;
}

export function mapCoachArticleError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to manage coach articles.';
  }
  if (message.includes('Not authorized')) {
    return 'Not authorized.';
  }
  return message;
}

function parseArticleSummary(row: Record<string, unknown>): CoachArticleSummary | null {
  const id = readString(row.id);
  const title = readStringAllowEmpty(row.title);
  const slug = readStringAllowEmpty(row.slug);
  const updatedAt = readString(row.updatedAt);
  if (!id || !updatedAt) {
    return null;
  }
  return {
    id,
    title,
    slug,
    category: readStringAllowEmpty(row.category),
    archetype: readStringAllowEmpty(row.archetype),
    status: readStatus(row.status),
    publishedAt: readString(row.publishedAt),
    modifiedAt: readString(row.modifiedAt),
    updatedAt,
  };
}

function parseArticle(row: Record<string, unknown>): CoachArticle | null {
  const id = readString(row.id);
  const createdAt = readString(row.createdAt);
  const updatedAt = readString(row.updatedAt);
  if (!id || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    title: readStringAllowEmpty(row.title),
    slug: readStringAllowEmpty(row.slug),
    category: readStringAllowEmpty(row.category),
    archetype: readStringAllowEmpty(row.archetype),
    answerFirst: readStringAllowEmpty(row.answerFirst),
    description: readStringAllowEmpty(row.description),
    bodyMarkdown: readStringAllowEmpty(row.bodyMarkdown),
    authorDisplayName: readStringAllowEmpty(row.authorDisplayName),
    status: readStatus(row.status),
    pillarPath: readStringAllowEmpty(row.pillarPath),
    cannibalisationNote: readStringAllowEmpty(row.cannibalisationNote),
    libraryLinks: asStringArray(row.libraryLinks),
    relatedPostSlugs: asStringArray(row.relatedPostSlugs),
    photos: readPhotos(row.photos),
    publishedAt: readString(row.publishedAt),
    modifiedAt: readString(row.modifiedAt),
    exportSnapshot:
      row.exportSnapshot && typeof row.exportSnapshot === 'object'
        ? (row.exportSnapshot as Record<string, unknown>)
        : null,
    createdAt,
    updatedAt,
  };
}

export async function fetchCoachArticles(input: {
  status?: string | null;
  category?: string | null;
}): Promise<{ data: CoachArticleSummary[] | null; error: CoachArticleApiError | null }> {
  const { data, error } = await callRpc('coach_list_articles', {
    p_status: input.status ?? null,
    p_category: input.category ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapCoachArticleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const articles = asArray(raw.articles)
    .map(parseArticleSummary)
    .filter((a): a is CoachArticleSummary => a !== null);

  return { data: articles, error: null };
}

export async function fetchCoachArticle(
  id: string
): Promise<{ data: CoachArticle | null; error: CoachArticleApiError | null }> {
  const { data, error } = await callRpc('coach_get_article', { p_id: id });

  if (error) {
    return { data: null, error: { message: mapCoachArticleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  if (!raw.article) {
    return { data: null, error: { message: 'Article not found.' } };
  }

  const article = parseArticle(asRecord(raw.article));
  if (!article) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: article, error: null };
}

export async function upsertCoachArticle(input: UpsertCoachArticleInput): Promise<{
  data: CoachArticle | null;
  error: CoachArticleApiError | null;
}> {
  const { data, error } = await callRpc('coach_upsert_article', {
    p_id: input.id ?? null,
    p_title: input.title,
    p_slug: input.slug,
    p_category: input.category,
    p_archetype: input.archetype,
    p_answer_first: input.answerFirst,
    p_description: input.description,
    p_body_markdown: input.bodyMarkdown,
    p_author_display_name: input.authorDisplayName,
    p_pillar_path: input.pillarPath,
    p_cannibalisation_note: input.cannibalisationNote,
    p_library_links: input.libraryLinks,
    p_related_post_slugs: input.relatedPostSlugs,
    p_photos: input.photos ?? [],
  });

  if (error) {
    return { data: null, error: { message: mapCoachArticleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const article = parseArticle(asRecord(raw.article));
  if (!article) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: article, error: null };
}

export async function setCoachArticleStatus(
  id: string,
  status: 'draft' | 'ready'
): Promise<{ data: CoachArticle | null; error: CoachArticleApiError | null }> {
  const { data, error } = await callRpc('coach_set_article_status', {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return { data: null, error: { message: mapCoachArticleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const article = parseArticle(asRecord(raw.article));
  if (!article) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: article, error: null };
}

export async function publishCoachArticle(
  id: string,
  snapshot: Record<string, unknown>
): Promise<{ data: CoachArticle | null; error: CoachArticleApiError | null }> {
  const { data, error } = await callRpc('coach_publish_article', {
    p_id: id,
    p_snapshot: snapshot,
  });

  if (error) {
    return { data: null, error: { message: mapCoachArticleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const article = parseArticle(asRecord(raw.article));
  if (!article) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: article, error: null };
}
