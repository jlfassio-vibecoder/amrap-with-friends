import { next } from '@vercel/edge';
import { CONSENT_REGION_COOKIE, countryRequiresConsent } from './src/lib/analytics/consentRegion';
import { NOT_FOUND_EVENT } from './src/lib/analytics/edgeEvents';
import {
  shareOgDescription,
  shareOgImage,
  shareOgImageSize,
  shareOgTitle,
  type ShareSummary,
} from './src/lib/share/shareOg';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, isKnownRoute, resolveSeo } from './src/lib/seo/routes';

const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|applebot|embedly|quora link preview|pinterest|redditbot|vkshare|skypeuripreview/i;

/** Invite routes whose whole job is to unfurl in a group chat. */
const OG_ROUTES = new Set(['/join', '/campaign/join', '/squad/join']);

/** `/s/abc12345` — the share link. Matched here rather than added to OG_ROUTES because it carries an id. */
const SHARE_PATH = /^\/s\/([0-9a-hjkmnp-tv-z]{8})$/;

/**
 * Fetches what a share link is allowed to say about itself.
 *
 * Returns null on any failure, and the caller falls back to the generic card:
 * a link pasted into a group chat has to unfurl as *something*, and a preview
 * that fails is worse than a generic one.
 */
async function fetchShareSummary(shareId: string): Promise<ShareSummary | null> {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_share_summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_share_id: shareId }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as Record<string, unknown>;
    if (body.ok !== true) {
      return null;
    }
    return {
      shareId: String(body.shareId ?? shareId),
      imagePath: typeof body.imagePath === 'string' ? body.imagePath : null,
      templateId: typeof body.templateId === 'string' ? body.templateId : null,
      durationMinutes: Number(body.durationMinutes ?? 0),
      rounds: Number(body.rounds ?? 0),
      reps: Number(body.reps ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Everything except build output and files with an extension (`/favicon.ico`,
 * `/robots.txt`, `/audio/*.mp3`). Those are real static assets and must fall
 * through untouched. `_app-shell` is the SPA HTML that `vercel.json` rewrites
 * app routes onto — with `cleanUrls` the destination is `/_app-shell`, not
 * `/_app-shell/index.html`, so the matcher must not treat it as unknown.
 */
export const config = {
  matcher: ['/((?!_vercel|assets/|_app-shell(?:/|$)|.*\\.[a-zA-Z0-9]+$).*)'],
};

/**
 * Tells the browser whether this visitor's region needs a consent prompt,
 * without the page having to ask a server or a third party.
 *
 * The country is only ever read, never stored: the cookie carries a single
 * bit — needs asking, or not — and no identifier, which is why setting it does
 * not itself require consent. `SameSite=Lax` and no `HttpOnly`, because the
 * page's own script is the only thing that reads it.
 */
function consentRegionCookie(request: Request): string {
  const country = request.headers.get('x-vercel-ip-country');
  const required = countryRequiresConsent(country) ? '1' : '0';
  return `${CONSENT_REGION_COOKIE}=${required}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // SPA shell file: vercel.json rewrites /create etc. here under cleanUrls.
  if (pathname === '/_app-shell' || pathname.startsWith('/_app-shell/')) {
    return next({ headers: { 'set-cookie': consentRegionCookie(request) } });
  }

  // A catch-all rewrite to index.html answers every typo with HTTP 200 and an
  // empty shell. At the scale of an unbounded URL space that is a soft-404
  // problem, so unknown paths get a real 404 here, before the rewrite runs.
  if (!isKnownRoute(pathname)) {
    return new Response(notFoundHtml(url.origin, pathname), {
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

  // A share link unfurls for crawlers with the athlete's own card; a human
  // gets the SPA. Only the crawler path costs a database round trip.
  const shareMatch = SHARE_PATH.exec(pathname);
  if (shareMatch && BOT_UA.test(ua)) {
    const shareId = shareMatch[1] as string;
    const summary = await fetchShareSummary(shareId);
    const image = shareOgImage(summary, url.origin, process.env.VITE_SUPABASE_URL?.trim() ?? null);
    const imageSize = shareOgImageSize(summary);
    const title = shareOgTitle(summary);
    const description = shareOgDescription(summary);
    const pageUrl = url.toString();
    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeAttr(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="robots" content="noindex, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:width" content="${imageSize.width}" />
  <meta property="og:image:height" content="${imageSize.height}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
</head>
<body>
  <p><a href="${escapeAttr(pageUrl)}">Open AMRAP With Friends</a></p>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-robots-tag': 'noindex, follow',
          // Short: the card image can arrive moments after the row does, and a
          // long cache would pin the generic fallback in front of it.
          'cache-control': 'public, max-age=60',
          'set-cookie': consentRegionCookie(request),
        },
      }
    );
  }

  // Signed-in, private and ephemeral surfaces must stay out of the index. The
  // header says so without the crawler needing to render anything, which the
  // robots meta tag in the SPA cannot promise.
  if (!BOT_UA.test(ua) || !OG_ROUTES.has(pathname)) {
    return next({
      headers: {
        'x-robots-tag': seo.robots,
        'set-cookie': consentRegionCookie(request),
      },
    });
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
/**
 * Reports the 404 and nothing else.
 *
 * Broken inbound links and stale URLs were invisible: this page carries no
 * Astro layout, so the script that reports every other page never ran here.
 *
 * Deliberately anonymous — no browser id, no storage read or write — so it
 * needs no consent anywhere, and it is the right shape besides: a 404 is a
 * fact about a URL, not about a person. The keys are injected from the edge's
 * own environment and the whole thing is skipped when they are absent, so a
 * misconfigured deploy serves the same page without the reporting.
 */
function notFoundBeacon(pathname: string): string {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return '';
  }
  const payload = escapeScriptJson(
    JSON.stringify({
      endpoint: `${url}/rest/v1/analytics_events`,
      key,
      event: NOT_FOUND_EVENT,
      path: pathname,
    })
  );
  return `<script>
(function(){try{var c=${payload};var r='';try{r=document.referrer?new URL(document.referrer).hostname:'';}catch(e){}
fetch(c.endpoint,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},
body:JSON.stringify({event_name:c.event,occurred_at:new Date().toISOString(),route:c.path,props:{path:c.path,referrer_host:r}})}).catch(function(){});}catch(e){}})();
</script>`;
}

function notFoundHtml(origin: string, pathname: string): string {
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
  ${notFoundBeacon(pathname)}
</body>
</html>`;
}

/**
 * Make a JSON literal safe to inline in a <script> block.
 *
 * `new URL()` already percent-encodes `<` and `>` in a pathname, so today
 * nothing can carry a literal `</script>` this far -- this is not fixing a
 * live hole. It is here because the safety currently rests on an implicit
 * parser behaviour a refactor could remove without anyone noticing, and one
 * `\u003c` is cheaper than that risk. U+2028/9 are escaped for the separate
 * reason that they are valid JSON but terminate a JavaScript line.
 */
function escapeScriptJson(value: string): string {
  return value
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
