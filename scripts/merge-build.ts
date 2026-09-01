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
import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { buildLlmsTxt, buildSitemapXml, indexableUrls } from '../src/lib/seo/sitemap';
import { SITE_ORIGIN, isAppRoute } from '../src/lib/seo/routes';

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

  await assertSitemapMatchesBuild();

  console.log(`Merged ${SITE_BUILD} + ${APP_BUILD} into ${OUT}/`);
}

void main();

/**
 * A sitemap that lists a URL nobody built is a pile of soft 404s handed straight
 * to Google. The route table and the Astro pages are generated from the same
 * data, so they should never disagree — this is the check that they did not.
 */
async function assertSitemapMatchesBuild(): Promise<void> {
  const missing: string[] = [];

  for (const url of indexableUrls()) {
    const pathname = url.slice(SITE_ORIGIN.length);
    // App routes are the SPA shell, served by a rewrite rather than a file.
    if (isAppRoute(pathname)) {
      continue;
    }
    const file = pathname === '/' ? `${OUT}/index.html` : `${OUT}${pathname}.html`;
    try {
      await access(file);
    } catch {
      missing.push(`${pathname} (expected ${file})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Sitemap lists ${missing.length} URL(s) with no page in the build:\n  ${missing.join('\n  ')}`
    );
  }
}
