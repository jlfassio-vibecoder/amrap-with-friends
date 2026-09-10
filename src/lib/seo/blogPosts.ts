import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CommittedBlogPost = {
  slug: string;
  category: string;
  publishedAt: string;
};

const DEFAULT_BLOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../site/content/blog'
);

const MIN_POSTS_FOR_CATEGORY_HUB = 3;

/**
 * Read committed blog Markdown frontmatter for sitemap listing.
 * Offline — no network. Same files Astro's content collection builds.
 */
export function listCommittedBlogPosts(blogDir: string = DEFAULT_BLOG_DIR): CommittedBlogPost[] {
  if (!existsSync(blogDir)) {
    return [];
  }

  const posts: CommittedBlogPost[] = [];
  for (const name of readdirSync(blogDir)) {
    if (!name.endsWith('.md')) {
      continue;
    }
    const raw = readFileSync(path.join(blogDir, name), 'utf8');
    const parsed = parseFrontmatterFields(raw);
    const slug = parsed.slug || name.slice(0, -3);
    if (!slug) {
      continue;
    }
    posts.push({
      slug,
      category: parsed.category ?? '',
      publishedAt: parsed.publishedAt ?? '',
    });
  }

  return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Category hub paths only when that category has ≥3 committed posts. */
export function blogCategoryHubPaths(
  posts: CommittedBlogPost[] = listCommittedBlogPosts(),
  minCount: number = MIN_POSTS_FOR_CATEGORY_HUB
): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.category) {
      continue;
    }
    counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([id]) => `/blog/category/${id}`)
    .sort();
}

export function blogPostPaths(posts: CommittedBlogPost[] = listCommittedBlogPosts()): string[] {
  return posts.map((post) => `/blog/${post.slug}`);
}

function parseFrontmatterFields(raw: string): {
  slug?: string;
  category?: string;
  publishedAt?: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }
  const block = match[1]!;
  const out: { slug?: string; category?: string; publishedAt?: string } = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^(slug|category|publishedAt):\s*(.*)$/);
    if (!m) {
      continue;
    }
    const key = m[1] as 'slug' | 'category' | 'publishedAt';
    let value = m[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
