/**
 * Compose 1200×630 OG cards from brand logos on the night ground.
 * Usage: npx tsx scripts/generate-og-images.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const WIDTH = 1200;
const HEIGHT = 630;
const LOGO_SIZE = 520;
const NIGHT = { r: 6, g: 21, b: 33, alpha: 1 };

async function compose(logoFile: string, outFile: string): Promise<void> {
  const logo = await sharp(path.join(PUBLIC, 'brand', logoFile))
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: NIGHT })
    .png()
    .toBuffer();

  const left = Math.round((WIDTH - LOGO_SIZE) / 2);
  const top = Math.round((HEIGHT - LOGO_SIZE) / 2);

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: NIGHT,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(PUBLIC, outFile));

  console.log(`Wrote public/${outFile}`);
}

await compose('logo-female.png', 'og-image-f.png');
await compose('logo-male.png', 'og-image-m.png');
await compose('logo-female.png', 'og-image.png');
