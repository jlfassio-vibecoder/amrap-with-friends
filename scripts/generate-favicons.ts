/**
 * Build favicon / apple-touch icons from the female brand mark.
 * Usage: npx tsx scripts/generate-favicons.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCE = path.join(PUBLIC, 'brand', 'logo-female.png');

async function pngAt(size: number): Promise<Buffer> {
  return sharp(SOURCE).resize(size, size, { fit: 'cover', position: 'centre' }).png().toBuffer();
}

async function writePng(filename: string, size: number): Promise<void> {
  const out = path.join(PUBLIC, filename);
  await sharp(SOURCE).resize(size, size, { fit: 'cover', position: 'centre' }).png().toFile(out);
  console.log(`Wrote public/${filename} (${size}×${size})`);
}

await writePng('favicon-16.png', 16);
await writePng('favicon-32.png', 32);
await writePng('apple-touch-icon.png', 180);

const ico = await pngToIco([await pngAt(16), await pngAt(32), await pngAt(48)]);
await fs.writeFile(path.join(PUBLIC, 'favicon.ico'), ico);
console.log('Wrote public/favicon.ico (16/32/48)');
