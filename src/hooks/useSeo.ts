import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_ORIGIN, resolveSeo } from '@/lib/seo/routes';

function upsertMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  content: string
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const element = existing ?? document.createElement('link');
  element.setAttribute('rel', 'canonical');
  element.setAttribute('href', href);
  if (!existing) {
    document.head.appendChild(element);
  }
}

/**
 * Keeps the document head in step with the current route.
 *
 * The edge middleware already sends `X-Robots-Tag` and the 404 status for
 * crawlers that never run JavaScript; this is what a rendering crawler and the
 * browser tab see, and it is the only thing that updates on a client-side
 * navigation, which never touches the server at all.
 */
export function useSeo(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = resolveSeo(pathname);
    const url = `${SITE_ORIGIN}${pathname}`;

    document.title = seo.title;
    upsertMeta('meta[name="description"]', 'name', 'description', seo.description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', seo.robots);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);
    setCanonical(seo.canonical);
  }, [pathname]);
}
