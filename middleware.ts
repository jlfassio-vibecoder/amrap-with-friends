import { next } from '@vercel/edge';
import { CONSENT_REGION_COOKIE, countryRequiresConsent } from './src/lib/analytics/consentRegion';
import { NOT_FOUND_EVENT } from './src/lib/analytics/edgeEvents';
import {
  shareOgDescription,
  shareOgImage,
  shareOgImageSize,
  shareOgTitle,
  shareTwitterImage,
  type ShareSummary,
} from './src/lib/share/shareOg';
import { injectShareMeta } from './src/lib/share/shareShell';
import {
  roomCanonical,
  roomOgDescription,
  roomOgImage,
  roomOgTitle,
  type RoomSummary,
} from './src/lib/rooms/roomOg';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, isKnownRoute, resolveSeo } from './src/lib/seo/routes';

const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|applebot|embedly|quora link preview|pinterest|redditbot|vkshare|skypeuripreview/i;

/** Invite routes whose whole job is to unfurl in a group chat. */
const OG_ROUTES = new Set(['/join', '/campaign/join', '/squad/join']);

/** `/s/abc12345` — the share link. Matched here rather than added to OG_ROUTES because it carries an id. */
const SHARE_PATH = /^\/s\/([0-9a-hjkmnp-tv-z]{8})$/;

/** `/@handle` — a room. Same shape the database enforces, so a malformed one 404s here. */
const ROOM_PATH = /^\/@([a-z0-9][a-z0-9_]{2,23})$/i;

/**
 * Fetches what a share link is allowed to say about itself.
 *
 * Returns null on any failure, and the caller falls back to the generic card:
 * a link pasted into a group chat has to unfurl as *something*, and a preview
 * that fails is worse than a generic one.
 */
/**
 * What a room link is allowed to say about itself.
 *
 * Returns the summary, or the handle it moved to, or null. Null falls back to
 * the generic card, for the same reason the share path does: a link in a group
 * chat has to unfurl as something.
 */
async function fetchRoomSummary(
  handle: string
): Promise<{ room: RoomSummary | null; movedTo: string | null }> {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { room: null, movedTo: null };
  }
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_room_by_handle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_handle: handle.toLowerCase() }),
    });
    if (!response.ok) {
      return { room: null, movedTo: null };
    }
    const body = (await response.json()) as Record<string, unknown>;
    if (body.ok !== true) {
      const movedTo =
        body.reason === 'moved' && typeof body.handle === 'string' ? body.handle : null;
      return { room: null, movedTo };
    }
    const room = body.room as Record<string, unknown> | undefined;
    if (!room || typeof room.handle !== 'string') {
      return { room: null, movedTo: null };
    }
    return {
      room: {
        handle: room.handle,
        displayName: typeof room.display_name === 'string' ? room.display_name : room.handle,
        intro: typeof room.intro === 'string' ? room.intro : null,
        memberCount: Number(room.member_count ?? 0),
        avatarPath: typeof room.avatar_path === 'string' ? room.avatar_path : null,
      },
      movedTo: null,
    };
  } catch {
    return { room: null, movedTo: null };
  }
}

/**
 * The built app shell, which the share page decorates rather than replaces.
 *
 * `_app-shell` is excluded from this middleware's matcher, so fetching it here
 * cannot recurse. Null on any failure — the caller falls through to the normal
 * response, which costs the card but never the page.
 */
async function fetchAppShell(origin: string): Promise<string | null> {
  try {
    const response = await fetch(`${origin}/_app-shell`, {
      headers: { accept: 'text/html' },
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

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
      wideImagePath: typeof body.wideImagePath === 'string' ? body.wideImagePath : null,
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
  // `/@:handle` matches any non-empty segment, so the route table alone would
  // accept `/@ab` and hand back a 200 shell. The handle shape is the database's
  // rule, and a path that could never name a room is a real 404.
  const malformedRoom = pathname.startsWith('/@') && !ROOM_PATH.test(pathname);

  if (!isKnownRoute(pathname) || malformedRoom) {
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

  // A share link unfurls with the athlete's own card for *every* client, not
  // just the ones whose user agent we recognised.
  //
  // This used to gate on a list of known crawlers and hand everyone else the
  // app shell, whose head advertises the site: og:title the product name,
  // og:image the logo, og:url the homepage. Apple's Messages fetches with an
  // ordinary Safari user agent, so a link pasted into a text message got that
  // — no card, and a claim that the link was really the homepage — while the
  // same link on Facebook showed the card. A user-agent allowlist cannot be
  // completed, so this stops keeping one.
  // A room link unfurls the same way a share link does, and for the same
  // reason gets its real tags regardless of who is asking.
  const roomMatch = ROOM_PATH.exec(pathname);
  if (roomMatch) {
    const handle = (roomMatch[1] as string).toLowerCase();

    // A handle typed in the wrong case is the same room, not a second URL.
    if (pathname !== `/@${handle}`) {
      return Response.redirect(`${url.origin}/@${handle}${url.search}`, 308);
    }

    const [summary, shell] = await Promise.all([
      fetchRoomSummary(handle),
      fetchAppShell(url.origin),
    ]);

    // A renamed room keeps answering its old address, because share cards
    // carrying it are already in group chats and cannot be recalled.
    if (summary.movedTo) {
      return Response.redirect(`${url.origin}/@${summary.movedTo}${url.search}`, 301);
    }

    if (shell !== null) {
      return new Response(
        injectShareMeta(shell, {
          title: roomOgTitle(summary.room),
          description: roomOgDescription(summary.room),
          url: roomCanonical(url.origin, handle),
          image: roomOgImage(
            summary.room,
            url.origin,
            process.env.VITE_SUPABASE_URL?.trim() ?? null
          ),
          imageWidth: 1200,
          imageHeight: 630,
          twitterImage: roomOgImage(
            summary.room,
            url.origin,
            process.env.VITE_SUPABASE_URL?.trim() ?? null
          ),
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            // Rooms are public pages meant to be found, unlike share links.
            'x-robots-tag': summary.room ? 'index, follow' : 'noindex, follow',
            'cache-control': 'public, max-age=60',
            'set-cookie': consentRegionCookie(request),
          },
        }
      );
    }
  }

  const shareMatch = SHARE_PATH.exec(pathname);
  if (shareMatch) {
    const shareId = shareMatch[1] as string;
    const [summary, shell] = await Promise.all([
      fetchShareSummary(shareId),
      fetchAppShell(url.origin),
    ]);
    // No shell means the deploy is mid-flight or the fetch failed. Falling
    // through to next() costs the card, not the page.
    if (shell !== null) {
      const imageSize = shareOgImageSize(summary);
      return new Response(
        injectShareMeta(shell, {
          title: shareOgTitle(summary),
          description: shareOgDescription(summary),
          url: url.toString(),
          image: shareOgImage(summary, url.origin, process.env.VITE_SUPABASE_URL?.trim() ?? null),
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          twitterImage: shareTwitterImage(
            summary,
            url.origin,
            process.env.VITE_SUPABASE_URL?.trim() ?? null
          ),
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-robots-tag': 'noindex, follow',
            // Short: the card image can arrive moments after the row does, and
            // a long cache would pin the generic fallback in front of it.
            'cache-control': 'public, max-age=60',
            'set-cookie': consentRegionCookie(request),
          },
        }
      );
    }
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
