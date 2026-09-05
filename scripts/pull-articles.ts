/**
 * Pull published coach-article export snapshots into Astro content + OG cards.
 *
 *   npm run seo:pull-articles
 *
 * Needs `VITE_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`.
 * Writes `site/content/blog/{slug}.md` and `public/og/blog/{slug}.png`, then
 * humans commit the diff — same posture as `seo:resolve-exercise-media`.
 * Prunes orphaned MD/OG files by default so demoted posts leave the site.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { ArticleExportSnapshot } from '../src/lib/coach/articles/buildArticleExportSnapshot';
import { renderArticleMarkdown } from '../src/lib/coach/articles/renderArticleMarkdown';
import { renderOgCard } from './renderOgCard';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'site/content/blog');
const OG_DIR = path.join(ROOT, 'public/og/blog');
const LOGO = path.join(ROOT, 'public/brand/logo-female.png');

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseSnapshot(raw: unknown): ArticleExportSnapshot | null {
  const row = asRecord(raw);
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const slug = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
  const description = typeof row.description === 'string' ? row.description : '';
  const answerFirst = typeof row.answerFirst === 'string' ? row.answerFirst : '';
  const author = typeof row.author === 'string' ? row.author : '';
  const body = typeof row.body === 'string' ? row.body : '';
  const publishedAt = typeof row.publishedAt === 'string' ? row.publishedAt : '';
  const modifiedAt = typeof row.modifiedAt === 'string' ? row.modifiedAt : '';
  if (!title || !slug || !description || !answerFirst || !author || !publishedAt || !modifiedAt) {
    return null;
  }

  const photosRaw = Array.isArray(row.photos) ? row.photos : [];
  const photos: ArticleExportSnapshot['photos'] = [];
  for (const item of photosRaw) {
    const photo = asRecord(item);
    const src = typeof photo.src === 'string' ? photo.src.trim() : '';
    const alt = typeof photo.alt === 'string' ? photo.alt.trim() : '';
    if (!src || !alt) {
      continue;
    }
    const caption = typeof photo.caption === 'string' ? photo.caption.trim() : '';
    photos.push(caption ? { src, alt, caption } : { src, alt });
  }

  const libraryLinks = Array.isArray(row.libraryLinks)
    ? row.libraryLinks.filter((v): v is string => typeof v === 'string')
    : [];
  const relatedPosts = Array.isArray(row.relatedPosts)
    ? row.relatedPosts.filter((v): v is string => typeof v === 'string')
    : [];

  return {
    title,
    slug,
    category: typeof row.category === 'string' ? row.category : '',
    archetype: typeof row.archetype === 'string' ? row.archetype : '',
    answerFirst,
    description,
    author,
    pillar: typeof row.pillar === 'string' ? row.pillar : '',
    libraryLinks,
    relatedPosts,
    photos,
    publishedAt,
    modifiedAt,
    body,
  };
}

async function main(): Promise<void> {
  loadEnvFile(path.join(ROOT, '.env'));
  loadEnvFile(path.join(ROOT, '.env.local'));

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing env. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('list_published_article_exports');
  if (error) {
    console.error(`list_published_article_exports failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const payload = asRecord(data);
  if (payload.ok !== true) {
    console.error('list_published_article_exports returned an unexpected payload.');
    process.exitCode = 1;
    return;
  }

  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  mkdirSync(BLOG_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });

  const keptSlugs = new Set<string>();
  let written = 0;

  for (const item of articles) {
    const row = asRecord(item);
    const snapshot = parseSnapshot(row.snapshot);
    if (!snapshot) {
      console.warn(`Skipping article ${String(row.id ?? '?')}: invalid snapshot`);
      continue;
    }

    const mdPath = path.join(BLOG_DIR, `${snapshot.slug}.md`);
    writeFileSync(mdPath, renderArticleMarkdown(snapshot), 'utf8');
    keptSlugs.add(snapshot.slug);
    written += 1;

    const ogOut = path.join(OG_DIR, `${snapshot.slug}.png`);
    try {
      await renderOgCard({
        title: snapshot.title,
        logoFile: LOGO,
        outFile: ogOut,
      });
    } catch (err) {
      console.warn(
        `OG card for ${snapshot.slug} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Prune by default: demoted / unpublished posts leave the static site.
  let pruned = 0;
  for (const name of readdirSync(BLOG_DIR)) {
    if (!name.endsWith('.md')) {
      continue;
    }
    const slug = name.slice(0, -3);
    if (keptSlugs.has(slug)) {
      continue;
    }
    unlinkSync(path.join(BLOG_DIR, name));
    pruned += 1;
  }

  let prunedOg = 0;
  if (existsSync(OG_DIR)) {
    for (const name of readdirSync(OG_DIR)) {
      if (!name.endsWith('.png')) {
        continue;
      }
      const slug = name.slice(0, -4);
      if (keptSlugs.has(slug)) {
        continue;
      }
      unlinkSync(path.join(OG_DIR, name));
      prunedOg += 1;
    }
  }

  console.log(`Wrote ${written} article(s) to site/content/blog/.`);
  if (pruned > 0) {
    console.log(`Pruned ${pruned} orphaned MD file(s).`);
  }
  if (prunedOg > 0) {
    console.log(`Pruned ${prunedOg} orphaned OG card(s).`);
  }
  console.log('Commit the content (and public/og/blog) diff when ready.');
}

void main();
