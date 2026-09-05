import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { blogCategoryHubPaths, blogPostPaths, listCommittedBlogPosts } from '@/lib/seo/blogPosts';

describe('listCommittedBlogPosts', () => {
  it('reads slug, category and publishedAt from committed MD', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blog-posts-'));
    try {
      writeFileSync(
        path.join(dir, 'why-easy-days-matter.md'),
        `---
title: Why easy days matter
slug: why-easy-days-matter
category: programming
publishedAt: 2026-09-05T12:00:00.000Z
modifiedAt: 2026-09-05T12:00:00.000Z
---

Body
`,
        'utf8'
      );
      writeFileSync(
        path.join(dir, 'second.md'),
        `---
slug: second-post
category: programming
publishedAt: 2026-09-06T12:00:00.000Z
---

`,
        'utf8'
      );

      const posts = listCommittedBlogPosts(dir);
      expect(posts).toHaveLength(2);
      expect(posts[0]?.slug).toBe('second-post');
      expect(blogPostPaths(posts)).toEqual(['/blog/second-post', '/blog/why-easy-days-matter']);
      expect(blogCategoryHubPaths(posts)).toEqual([]);
      expect(blogCategoryHubPaths([...posts, ...posts, ...posts])).toEqual([
        '/blog/category/programming',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
