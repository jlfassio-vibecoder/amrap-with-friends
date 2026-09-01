/**
 * Assembles the deployable `dist/` from the two builds.
 *
 * Astro owns the static content pages and the public assets; Vite builds the
 * React SPA. The SPA's entry HTML moves to `_app-shell/index.html` because
 * Astro's own `index.html` sits at the root — vercel.json rewrites every app
 * route to the shell, which is how rally links keep the URLs they already have.
 *
 * The sitemap and llms.txt are generated here from src/lib/seo/routes.ts rather
 * than committed, so they cannot drift from the routes they describe.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { buildLlmsTxt, buildSitemapXml } from '../src/lib/seo/sitemap';

const SITE_BUILD = 'dist-site';
const APP_BUILD = 'dist-app';
const OUT = 'dist';
const APP_SHELL = `${OUT}/_app-shell`;

async function main(): Promise<void> {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // Astro first: it brings the content pages plus everything from public/.
  await cp(SITE_BUILD, OUT, { recursive: true });

  // Then the SPA's hashed assets, which live at absolute /assets/* URLs.
  await cp(`${APP_BUILD}/assets`, `${OUT}/assets`, { recursive: true });

  await mkdir(APP_SHELL, { recursive: true });
  await cp(`${APP_BUILD}/index.html`, `${APP_SHELL}/index.html`);

  await writeFile(`${OUT}/sitemap.xml`, buildSitemapXml(), 'utf8');
  await writeFile(`${OUT}/llms.txt`, buildLlmsTxt(), 'utf8');

  console.log(`Merged ${SITE_BUILD} + ${APP_BUILD} into ${OUT}/`);
}

void main();
