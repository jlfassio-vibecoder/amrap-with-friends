import type { ArticleExportSnapshot } from './buildArticleExportSnapshot';

function yamlEscape(value: string): string {
  if (value === '') {
    return '""';
  }
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  if (/^\s|\s$/.test(value)) {
    return `"${value}"`;
  }
  return value;
}

function yamlStringArray(values: string[]): string {
  if (values.length === 0) {
    return '[]';
  }
  return `\n${values.map((v) => `  - ${yamlEscape(v)}`).join('\n')}`;
}

function yamlPhotos(photos: ArticleExportSnapshot['photos']): string {
  if (photos.length === 0) {
    return '[]';
  }
  return (
    '\n' +
    photos
      .map((photo) => {
        const lines = [`  - src: ${yamlEscape(photo.src)}`, `    alt: ${yamlEscape(photo.alt)}`];
        if (photo.caption) {
          lines.push(`    caption: ${yamlEscape(photo.caption)}`);
        }
        return lines.join('\n');
      })
      .join('\n')
  );
}

/** Render an export snapshot as Astro content-collection Markdown. */
export function renderArticleMarkdown(snapshot: ArticleExportSnapshot): string {
  const lines = [
    '---',
    `title: ${yamlEscape(snapshot.title)}`,
    `slug: ${yamlEscape(snapshot.slug)}`,
    `description: ${yamlEscape(snapshot.description)}`,
    `answerFirst: ${yamlEscape(snapshot.answerFirst)}`,
    `author: ${yamlEscape(snapshot.author)}`,
    `category: ${yamlEscape(snapshot.category)}`,
    `archetype: ${yamlEscape(snapshot.archetype)}`,
    `pillar: ${yamlEscape(snapshot.pillar)}`,
    `libraryLinks: ${yamlStringArray(snapshot.libraryLinks)}`,
    `relatedPosts: ${yamlStringArray(snapshot.relatedPosts)}`,
    `photos: ${yamlPhotos(snapshot.photos)}`,
    `publishedAt: "${snapshot.publishedAt.replace(/"/g, '\\"')}"`,
    `modifiedAt: "${snapshot.modifiedAt.replace(/"/g, '\\"')}"`,
    '---',
    '',
    snapshot.body.replace(/\r\n/g, '\n').trimEnd(),
    '',
  ];
  return lines.join('\n');
}
