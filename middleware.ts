import { next } from '@vercel/edge';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, isKnownRoute, resolveSeo } from './src/lib/seo/routes';

const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|applebot|embedly|quora link preview|pinterest|redditbot|vkshare|skypeuripreview/i;

/** Invite routes whose whole job is to unfurl in a group chat. */
const OG_ROUTES = new Set(['/join', '/campaign/join', '/squad/join']);

/**
 * Everything except build output and files with an extension (`/favicon.ico`,
 * `/robots.txt`, `/audio/*.mp3`). Those are real static assets and must fall
 * through untouched.
 */
export const config = {
  matcher: ['/((?!_vercel|assets/|.*\\.[a-zA-Z0-9]+$).*)'],
};

export default function middleware(request: Request): Response | Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // A catch-all rewrite to index.html answers every typo with HTTP 200 and an
  // empty shell. At the scale of an unbounded URL space that is a soft-404
  // problem, so unknown paths get a real 404 here, before the rewrite runs.
  if (!isKnownRoute(pathname)) {
    return new Response(notFoundHtml(url.origin), {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, follow',
        'cache-control': 'public, max-age=60',
      },
    });
  }

  const seo = resolveSeo(pathname);
  const ua = request.headers.get('user-agent') ?? '';

  // Signed-in, private and ephemeral surfaces must stay out of the index. The
  // header says so without the crawler needing to render anything, which the
  // robots meta tag in the SPA cannot promise.
  if (!BOT_UA.test(ua) || !OG_ROUTES.has(pathname)) {
    return next({ headers: { 'x-robots-tag': seo.robots } });
  }

  const card = url.searchParams.get('card') === 'm' ? 'm' : 'f';
  const image = `${url.origin}/og-image-${card}.png`;
  const pageUrl = url.toString();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${DEFAULT_TITLE}</title>
  <meta name="description" content="${DEFAULT_DESCRIPTION}" />
  <meta name="robots" content="${seo.robots}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${DEFAULT_TITLE}" />
  <meta property="og:description" content="${DEFAULT_DESCRIPTION}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="AMRAP With Friends logo" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${DEFAULT_TITLE}" />
  <meta name="twitter:description" content="${DEFAULT_DESCRIPTION}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
${seo.canonical ? `  <link rel="canonical" href="${escapeAttr(seo.canonical)}" />\n` : ''}</head>
<body>
  <p><a href="${escapeAttr(pageUrl)}">Open AMRAP With Friends</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': seo.robots,
      'cache-control': 'public, max-age=300',
    },
  });
}

/**
 * Standalone rather than the app shell: the app never boots here, so a crawler
 * gets the 404 status and a plain explanation in one round trip. Colours are
 * the light-theme page/ink tokens, inlined because this page loads no CSS.
 */
function notFoundHtml(origin: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, follow" />
  <title>Page not found — AMRAP With Friends</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
           background: #f7f2ea; color: #211d18; padding: 24px;
           font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 32rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { margin: 0 0 1.5rem; color: #8a8072; line-height: 1.6; }
    a { color: #211d18; }
  </style>
</head>
<body>
  <main>
    <h1>Page not found</h1>
    <p>That link does not point anywhere. A rally point closes once its mission
       is done, so an old rally link will land here too.</p>
    <p><a href="${escapeAttr(origin)}/">Back to AMRAP With Friends</a></p>
  </main>
</body>
</html>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
