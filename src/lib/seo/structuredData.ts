import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from '@/lib/seo/routes';

/** Loosely typed on purpose: schema.org shapes vary per type and we emit them verbatim. */
export type JsonLd = Record<string, unknown>;

const LOGO = `${SITE_ORIGIN}/brand/logo.png`;
const OG_IMAGE = `${SITE_ORIGIN}/og-image-f.png`;

/** Entity resolution: the node an assistant attaches "AMRAP With Friends" facts to. */
export function organization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    logo: LOGO,
    description: DEFAULT_DESCRIPTION,
  };
}

export function webApplication(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    url: `${SITE_ORIGIN}/`,
    image: OG_IMAGE,
    logo: LOGO,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export interface BreadcrumbEntry {
  name: string;
  /** Path, not a full URL — the origin is added here so callers cannot disagree about it. */
  path: string;
}

export function breadcrumbList(entries: BreadcrumbEntry[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: entry.name,
      item: `${SITE_ORIGIN}${entry.path}`,
    })),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Pairs with the answer-first writing rule: the same question and its 40–60 word
 * answer appear in the visible copy. Markup that does not match what a reader
 * sees is a spam signal, so build both from one source.
 */
export function faqPage(entries: FaqEntry[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/** `</script>` inside a JSON string would close the tag early and inject markup. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
