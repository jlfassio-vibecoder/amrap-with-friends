import { describe, expect, it } from 'vitest';
import { renderArticleMarkdown } from './renderArticleMarkdown';
import type { ArticleExportSnapshot } from './buildArticleExportSnapshot';

const base: ArticleExportSnapshot = {
  title: 'Why easy days matter',
  slug: 'why-easy-days-matter',
  category: 'programming',
  archetype: 'opinion-pov',
  answerFirst: 'Because fatigue ruins the retest.',
  description: 'A short take on easy days.',
  author: 'Coach',
  pillar: '/guides',
  libraryLinks: ['/exercises/push-up', '/amrap-workouts'],
  relatedPosts: [],
  photos: [{ src: 'https://cdn.test/p.jpg', alt: 'Demo', caption: 'Hold' }],
  publishedAt: '2026-09-05T12:00:00.000Z',
  modifiedAt: '2026-09-05T12:00:00.000Z',
  body: '## Body\n\nMore copy.',
};

describe('renderArticleMarkdown', () => {
  it('emits YAML frontmatter and body', () => {
    const md = renderArticleMarkdown(base);
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('title: Why easy days matter');
    expect(md).toContain('slug: why-easy-days-matter');
    expect(md).toContain('libraryLinks:');
    expect(md).toContain('  - /exercises/push-up');
    expect(md).toContain('photos:');
    expect(md).toContain('    alt: Demo');
    expect(md).toContain('## Body');
  });

  it('quotes values that need YAML escaping', () => {
    const md = renderArticleMarkdown({
      ...base,
      description: 'Say: "easy day"',
    });
    expect(md).toContain('description: "Say: \\"easy day\\""');
  });
});
