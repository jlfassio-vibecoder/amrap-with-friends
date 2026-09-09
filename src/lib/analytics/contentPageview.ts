import {
  buildAttribution,
  isAttributable,
  persistAttribution,
  readStoredAttribution,
  referrerHost,
} from '@/lib/analytics/attribution';
import { enforceConsentBoundary } from '@/lib/analytics/consent';
import { mountConsentBanner } from '@/lib/analytics/consentBanner';
import { sendContentEvent } from '@/lib/analytics/contentBeacon';
import { isAppRoute } from '@/lib/seo/routes';

/**
 * What the content pages report. Run from BaseLayout, so it covers every
 * static page including the generated exercise and workout pages.
 *
 * This is the half of acquisition the SPA cannot see: someone who arrives from
 * a search engine onto /amrap-workouts/10 and never opens the app was
 * completely invisible, which meant the entire content investment could not be
 * credited for anything.
 */
export function initContentAnalytics(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Before anything reads the id: a gated visitor carrying one from before the
  // gate existed has it removed rather than merely ignored.
  enforceConsentBoundary();

  // Asked before anything is stored, and only where the region requires it.
  // The pageview below still reports either way -- with no identifier when
  // consent is absent, which Article 5(3) does not reach -- so declining costs
  // the visitor's privacy nothing and costs us only the attribution link.
  mountConsentBanner();

  // First touch, captured with the same rules the app uses -- shared module,
  // not a second copy, so the two surfaces cannot drift on what counts as
  // organic or internal.
  const stored = readStoredAttribution();
  if (!stored) {
    const attribution = buildAttribution({
      referrer: document.referrer,
      search: window.location.search,
      pathname: window.location.pathname,
      host: window.location.hostname,
    });
    if (isAttributable(attribution)) {
      persistAttribution(attribution);
      sendContentEvent('first_touch_captured', {
        channel: attribution.channel,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        landing_path: attribution.landingPath,
      });
    }
  }

  // Compared as parsed hosts, not as a substring: a referrer of
  // https://google.com/search?q=amrapwithfriends.com contains our hostname in
  // its query, and a substring test would file that genuine organic arrival as
  // internal navigation.
  const fromHost = referrerHost(document.referrer);
  const selfHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

  sendContentEvent('content_page_viewed', {
    path: window.location.pathname,
    // Whether they came from outside or from another of our own pages: it is
    // the difference between an entry point and a page people read second.
    entry: fromHost !== selfHost,
  });

  // The conversion that matters: a click out of the content layer into the
  // app. Delegated on document so it covers links Astro renders anywhere,
  // and passive so it never delays the navigation.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest('a');
      const href = anchor?.getAttribute('href');
      if (!href || !href.startsWith('/') || !isAppRoute(href)) {
        return;
      }
      sendContentEvent('content_cta_clicked', {
        from_path: window.location.pathname,
        to_path: href,
      });
    },
    { passive: true }
  );
}
