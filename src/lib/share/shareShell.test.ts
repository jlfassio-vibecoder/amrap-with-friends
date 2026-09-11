import { describe, expect, it } from 'vitest';
import { injectShareMeta, type ShareMeta } from '@/lib/share/shareShell';

// Copied from the real /_app-shell response, wrapped attributes and all --
// the shell writes several of these across multiple lines, which a naive
// single-line regex silently fails to strip.
const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>AMRAP With Friends — Live Group AMRAP Workout Timer</title>
    <meta
      name="description"
      content="AMRAP With Friends is a live group workout timer."
    />
    <meta property="og:title" content="AMRAP With Friends — Live Group AMRAP Workout Timer" />
    <meta
      property="og:description"
      content="AMRAP With Friends is a live group workout timer."
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://amrapwithfriends.com/" />
    <meta property="og:image" content="https://amrapwithfriends.com/og-image-f.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="AMRAP With Friends logo" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="AMRAP With Friends — Live Group AMRAP Workout Timer" />
    <meta name="twitter:image" content="https://amrapwithfriends.com/og-image-f.png" />
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const meta: ShareMeta = {
  title: '23 rounds · 5 min AMRAP',
  description: 'Run the same clock with friends.',
  url: 'https://www.amrapwithfriends.com/s/6vtx923n',
  image: 'https://cdn.example.com/6vtx923n.png',
  imageWidth: 1080,
  imageHeight: 1920,
  twitterImage: 'https://cdn.example.com/6vtx923n-wide.png',
};

describe('injectShareMeta', () => {
  const out = injectShareMeta(SHELL, meta);

  it('advertises the share, not the site', () => {
    expect(out).toContain('<meta property="og:title" content="23 rounds · 5 min AMRAP" />');
    expect(out).toContain(
      '<meta property="og:image" content="https://cdn.example.com/6vtx923n.png" />'
    );
    expect(out).toContain('<meta property="og:image:height" content="1920" />');
  });

  it('points og:url at the share, which the shell pointed at the homepage', () => {
    // The worst of the old tags: it told every client the link *was* the
    // homepage, so some collapsed the two into one preview.
    expect(out).toContain('content="https://www.amrapwithfriends.com/s/6vtx923n"');
    expect(out).not.toContain('content="https://amrapwithfriends.com/"');
  });

  it('leaves no site-wide og or twitter tag behind, wrapped attributes included', () => {
    // A leftover og:image later in the head wins on some clients, so a
    // half-done strip is worse than none.
    expect(out).not.toContain('og-image-f.png');
    expect(out).not.toContain('Live Group AMRAP Workout Timer');
    expect(out.match(/property="og:image"/g)).toHaveLength(1);
    expect(out.match(/property="og:description"/g)).toHaveLength(1);
    expect(out.match(/name="twitter:image"/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
  });

  it('sends X the wide render, because X crops a portrait card to its middle', () => {
    // og:image and twitter:image are separate tags precisely because the
    // platforms crop differently. Measured on a posted card: X kept "540
    // reps", the movements and half the chart, and cropped away the hero, the
    // name, the link and the watermark.
    expect(out).toContain(
      '<meta name="twitter:image" content="https://cdn.example.com/6vtx923n-wide.png" />'
    );
    expect(out).toContain(
      '<meta property="og:image" content="https://cdn.example.com/6vtx923n.png" />'
    );
  });

  it('drops og:image:alt, which described the logo that is no longer there', () => {
    expect(out).not.toContain('og:image:alt');
  });

  it('keeps the app bootable — this is still the page a person lands on', () => {
    expect(out).toContain('<script type="module" src="/assets/index-abc.js"></script>');
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('<meta charset="UTF-8" />');
  });

  it('keeps a share page out of the index', () => {
    expect(out).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it('escapes a title that would otherwise break out of the attribute', () => {
    const hostile = injectShareMeta(SHELL, { ...meta, title: 'Bad" /><script>x</script>' });
    expect(hostile).not.toContain('<script>x</script>');
    expect(hostile).toContain('&quot;');
  });

  it('returns anything that is not a document untouched', () => {
    // Better a generic card than a mangled page.
    expect(injectShareMeta('not html', meta)).toBe('not html');
  });
});

describe('robots and canonical', () => {
  const base = {
    title: 'T',
    description: 'D',
    url: 'https://x.test/@coach',
    image: 'https://x.test/i.png',
    imageWidth: 1200,
    imageHeight: 630,
    twitterImage: 'https://x.test/i.png',
  };

  // A share link is one athlete's result; a search engine should not hold it.
  it('defaults to noindex, so share links keep the behaviour they had', () => {
    const html = injectShareMeta(SHELL, base);
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).not.toContain('rel="canonical"');
  });

  /**
   * The bug this was written for: the middleware sent `index, follow` as a
   * header while this injector wrote `noindex` into the document, and the
   * document wins. A public room would never have been indexed.
   */
  it('lets a room declare itself indexable', () => {
    const html = injectShareMeta(SHELL, {
      ...base,
      robots: 'index, follow',
      canonical: 'https://x.test/@coach',
    });
    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).not.toContain('noindex');
    expect(html).toContain('<link rel="canonical" href="https://x.test/@coach" />');
  });

  it('escapes a canonical rather than letting it break out of the attribute', () => {
    const html = injectShareMeta(SHELL, {
      ...base,
      canonical: 'https://x.test/@a"><script>x</script>',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&quot;');
  });
});
