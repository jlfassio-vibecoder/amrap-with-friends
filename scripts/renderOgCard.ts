/**
 * Compose 1200×630 OG cards on the night ground.
 * Used by generate-og-images (brand logos) and seo:pull-articles (blog titles).
 */
import sharp from 'sharp';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_NIGHT = { r: 6, g: 21, b: 33, alpha: 1 };

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap title into short lines for the OG SVG. */
export function wrapOgTitle(title: string, maxCharsPerLine = 28, maxLines = 4): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length >= maxLines - 1) {
      break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]!;
    const remaining = words.slice(lines.join(' ').split(/\s+/).filter(Boolean).length);
    if (remaining.length > 0 && !last.endsWith('…')) {
      lines[maxLines - 1] = `${last.replace(/\s+\S*$/, '')}…`.trim();
    }
  }
  return lines.slice(0, maxLines);
}

export type RenderOgCardInput = {
  /** Absolute path to the output PNG. */
  outFile: string;
  /** Optional display title (blog posts). When omitted, only the logo is drawn. */
  title?: string;
  /** Absolute path to a logo PNG under public/brand. */
  logoFile?: string;
  logoSize?: number;
};

/** Write a brand OG card, optionally with a title under the logo. */
export async function renderOgCard(input: RenderOgCardInput): Promise<void> {
  const logoSize = input.logoSize ?? (input.title ? 220 : 520);
  const layers: sharp.OverlayOptions[] = [];

  if (input.logoFile) {
    const logo = await sharp(input.logoFile)
      .resize(logoSize, logoSize, { fit: 'contain', background: OG_NIGHT })
      .png()
      .toBuffer();
    const left = Math.round((OG_WIDTH - logoSize) / 2);
    const top = input.title ? 72 : Math.round((OG_HEIGHT - logoSize) / 2);
    layers.push({ input: logo, left, top });
  }

  if (input.title?.trim()) {
    const lines = wrapOgTitle(input.title.trim());
    const fontSize = lines.length > 3 ? 42 : 48;
    const lineHeight = fontSize + 12;
    const blockHeight = lines.length * lineHeight;
    const startY = input.logoFile
      ? 72 + logoSize + 36 + fontSize
      : Math.round((OG_HEIGHT - blockHeight) / 2) + fontSize;
    const textSvg = Buffer.from(
      `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .t { fill: #f4f7fb; font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; font-size: ${fontSize}px; font-weight: 700; }
  </style>
  ${lines
    .map(
      (line, i) =>
        `<text class="t" x="50%" y="${startY + i * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join('\n  ')}
</svg>`
    );
    layers.push({ input: textSvg, left: 0, top: 0 });
  }

  await sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 4,
      background: OG_NIGHT,
    },
  })
    .composite(layers)
    .png()
    .toFile(input.outFile);
}
