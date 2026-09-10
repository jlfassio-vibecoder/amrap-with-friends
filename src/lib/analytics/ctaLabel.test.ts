import { afterEach, describe, expect, it } from 'vitest';
import { resolveCtaLabel } from '@/lib/analytics/ctaLabel';

function anchorIn(html: string): Element {
  document.body.innerHTML = html;
  const anchor = document.querySelector('a');
  if (!anchor) {
    throw new Error('fixture has no anchor');
  }
  return anchor;
}

describe('resolveCtaLabel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers an explicit label on the anchor', () => {
    expect(resolveCtaLabel(anchorIn('<a data-cta="hero-primary" href="/create">Go</a>'))).toBe(
      'hero-primary'
    );
  });

  it('inherits a label from an ancestor, so a group can be named once', () => {
    expect(resolveCtaLabel(anchorIn('<div data-cta="hero"><a href="/create">Go</a></div>'))).toBe(
      'hero'
    );
  });

  it('lets an explicit label beat the landmark it sits in', () => {
    expect(resolveCtaLabel(anchorIn('<header><a data-cta="logo" href="/">Home</a></header>'))).toBe(
      'logo'
    );
  });

  it('answers nav before header, since a nav inside a header is more specific', () => {
    expect(resolveCtaLabel(anchorIn('<header><nav><a href="/create">Go</a></nav></header>'))).toBe(
      'nav'
    );
  });

  it('falls back to the landmark, so nothing needs annotating to be useful', () => {
    expect(resolveCtaLabel(anchorIn('<header><a href="/create">Go</a></header>'))).toBe('header');
    expect(resolveCtaLabel(anchorIn('<footer><a href="/create">Go</a></footer>'))).toBe('footer');
    expect(resolveCtaLabel(anchorIn('<p><a href="/create">Go</a></p>'))).toBe('inline');
  });

  it('ignores an empty label rather than reporting a blank', () => {
    expect(resolveCtaLabel(anchorIn('<a data-cta="  " href="/create">Go</a>'))).toBe('inline');
  });

  it('caps a label, since the attribute is page-authored', () => {
    const long = 'x'.repeat(200);
    expect(resolveCtaLabel(anchorIn(`<a data-cta="${long}" href="/c">Go</a>`))).toHaveLength(64);
  });
});
