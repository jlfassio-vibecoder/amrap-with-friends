/**
 * Which link they clicked, not just where it went.
 *
 * content_cta_clicked recorded from_path and to_path, so on a page with a hero
 * button, a nav item and a closing link all pointing at /create, the three were
 * one number — and "this page converts at 12%" could never become "this
 * placement converts at 12%".
 *
 * An explicit data-cta wins, but the landmark fallback is what makes this worth
 * having: header, nav, footer and inline are distinguishable everywhere without
 * annotating a single one of the hundred-odd generated pages. Annotation is
 * then reserved for the handful of CTAs whose identity actually matters.
 */
export function resolveCtaLabel(anchor: Element): string {
  const labelled = anchor.closest('[data-cta]');
  const explicit = labelled?.getAttribute('data-cta')?.trim();
  if (explicit) {
    return explicit.slice(0, 64);
  }
  // Nav before header: a nav inside a header is the more specific answer, and
  // a site's header usually contains one.
  if (anchor.closest('nav')) {
    return 'nav';
  }
  if (anchor.closest('header')) {
    return 'header';
  }
  if (anchor.closest('footer')) {
    return 'footer';
  }
  return 'inline';
}
