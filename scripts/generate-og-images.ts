/**
 * Compose 1200×630 OG cards from brand logos on the night ground.
 * Usage: npx tsx scripts/generate-og-images.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOgCard } from './renderOgCard';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const BRAND = path.join(PUBLIC, 'brand');

async function compose(logoFile: string, outFile: string): Promise<void> {
  await renderOgCard({
    logoFile: path.join(BRAND, logoFile),
    outFile: path.join(PUBLIC, outFile),
  });
  console.log(`Wrote public/${outFile}`);
}

await compose('logo-female.png', 'og-image-f.png');
await compose('logo-male.png', 'og-image-m.png');
await compose('logo-female.png', 'og-image.png');
