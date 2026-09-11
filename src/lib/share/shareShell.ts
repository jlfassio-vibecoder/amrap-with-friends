/**
 * Put a share's own preview tags into the app shell.
 *
 * No `@/` alias and no imports, for the same reason as shareOg.ts: the edge
 * runtime does not resolve the alias.
 *
 * The share page used to serve its real tags only to user agents matching a
 * list of known crawlers, and the app shell to everyone else. The shell's head
 * is the *site's* head — its og:title is the product name, its og:image is the
 * logo, and its og:url is the homepage — so any fetcher not on the list was
 * told the link was the homepage and shown a logo.
 *
 * Plenty of things that unfurl links are not on any such list, and Apple's
 * Messages is one of them: it fetches with an ordinary Safari user agent. That
 * is why a link pasted into a text message showed no card while the same link
 * on Facebook showed the athlete's own.
 *
 * A user-agent allowlist cannot be completed, so this stops trying. Everyone
 * gets the same head, and the SPA still boots for people.
 */

export interface ShareMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** X crops a portrait card to a band out of its middle, so it gets the wide render. */
  twitterImage: string;
  /**
   * What the page tells crawlers. Defaults to `noindex, follow`, which is right
   * for a share link: one athlete's result is not a page a search engine should
   * hold. A room is the opposite -- a public address that exists to be found --
   * and passing a header alone would not have worked, because the tag written
   * here is in the document and contradicts it.
   */
  robots?: string;
  /** Rooms have one canonical address; shares have none worth declaring. */
  canonical?: string | null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Matches a whole meta tag even when its attributes wrap across lines, as the shell's do. */
function metaPattern(attribute: 'property' | 'name', prefix: string): RegExp {
  return new RegExp(`<meta\\s[^>]*${attribute}="${prefix}[^"]*"[^>]*>`, 'gi');
}

export function injectShareMeta(shell: string, meta: ShareMeta): string {
  const headEnd = shell.search(/<\/head>/i);
  if (headEnd === -1) {
    // Not a document we recognise. Returning it untouched is better than
    // returning something malformed: the page still works, the card is just
    // the generic one.
    return shell;
  }

  let head = shell.slice(0, headEnd);
  const rest = shell.slice(headEnd);

  // Strip what the shell says about the site, so nothing can win by being
  // later in the document than what we add.
  head = head
    .replace(metaPattern('property', 'og:'), '')
    .replace(metaPattern('name', 'twitter:'), '')
    .replace(/<meta\s[^>]*name="description"[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, '');

  const tags = [
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="robots" content="${escapeAttr(meta.robots ?? 'noindex, follow')}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.url)}" />`,
    `<meta property="og:image" content="${escapeAttr(meta.image)}" />`,
    `<meta property="og:image:width" content="${meta.imageWidth}" />`,
    `<meta property="og:image:height" content="${meta.imageHeight}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(meta.twitterImage)}" />`,
  ];

  if (meta.canonical) {
    // The shell carries no canonical (index.html must never claim one), so
    // this adds rather than replaces.
    tags.push(`<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
  }

  return `${head}\n    ${tags.join('\n    ')}\n  ${rest}`;
}
