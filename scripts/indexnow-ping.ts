/**
 * Tells Bing (and so Copilot and DuckDuckGo), Yandex and Seznam that our URLs
 * changed, instead of waiting to be recrawled. Google ignores IndexNow.
 *
 * Run after a production deploy:  npm run seo:indexnow
 *
 * The key is public by design — it is verified by fetching `keyLocation`, which
 * is why `public/${KEY}.txt` is committed and must contain exactly the key.
 */
import { SITE_ORIGIN, ROUTE_SEO, SITE_HOST } from '../src/lib/seo/routes';

const INDEXNOW_KEY = 'c1ba7466a91f72a4902febd5b6d24e6a';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function main(): Promise<void> {
  const urlList = ROUTE_SEO.filter((route) => route.index).map(
    (route) => `${SITE_ORIGIN}${route.path === '/' ? '/' : route.path}`
  );

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });

  // 200 = accepted, 202 = accepted but the key is still being verified.
  if (response.status !== 200 && response.status !== 202) {
    console.error(`IndexNow rejected the submission: ${response.status} ${response.statusText}`);
    console.error(await response.text());
    process.exitCode = 1;
    return;
  }

  console.log(`IndexNow accepted ${urlList.length} URLs (${response.status}).`);
}

void main();
