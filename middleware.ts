import { next } from '@vercel/edge';

const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|applebot|embedly|quora link preview|pinterest|redditbot|vkshare|skypeuripreview/i;

const SITE_TITLE = 'AMRAP With Friends — Live Group AMRAP Workout Timer';
const SITE_DESCRIPTION =
  'AMRAP With Friends is a live group workout timer for As Many Rounds As Possible sessions. Host or join a session, stay on a synced countdown, and race the leaderboard together.';

export const config = {
  matcher: ['/join', '/campaign/join', '/squad/join'],
};

export default function middleware(request: Request): Response | Promise<Response> {
  const ua = request.headers.get('user-agent') ?? '';
  if (!BOT_UA.test(ua)) {
    return next();
  }

  const url = new URL(request.url);
  const card = url.searchParams.get('card') === 'm' ? 'm' : 'f';
  const image = `${url.origin}/og-image-${card}.png`;
  const pageUrl = url.toString();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${SITE_TITLE}</title>
  <meta name="description" content="${SITE_DESCRIPTION}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${SITE_TITLE}" />
  <meta property="og:description" content="${SITE_DESCRIPTION}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="AMRAP With Friends logo" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${SITE_TITLE}" />
  <meta name="twitter:description" content="${SITE_DESCRIPTION}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeAttr(pageUrl)}">Open AMRAP With Friends</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
