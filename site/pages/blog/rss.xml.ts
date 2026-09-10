import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_NAME, SITE_ORIGIN } from '@/lib/seo/routes';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  let collection: Array<{
    data: { slug: string; title: string; description: string; publishedAt: string };
  }> = [];
  try {
    collection = await getCollection('blog');
  } catch {
    collection = [];
  }
  const posts = collection.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );

  const items = posts
    .map((post) => {
      const link = `${SITE_ORIGIN}/blog/${post.data.slug}`;
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(post.data.description)}</description>
      <pubDate>${new Date(post.data.publishedAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)} Blog</title>
    <link>${SITE_ORIGIN}/blog</link>
    <description>Training notes from AMRAP With Friends.</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
