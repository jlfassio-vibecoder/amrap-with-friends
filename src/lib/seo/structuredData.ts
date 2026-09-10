import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from '@/lib/seo/routes';
import { AUTHOR_ID, SITE_AUTHOR, isSiteAuthor } from '@/lib/seo/author';

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
    // Resolves the product and the person as one entity rather than two
    // unrelated ones, which is most of what the author page is for.
    founder: { '@id': AUTHOR_ID },
  };
}

/**
 * The author as a full entity, for the author page.
 *
 * `sameAs` is the load-bearing property: it is how an assistant confirms the
 * person in a byline is the person with the Yelp listing and the companies.
 * Omitted entirely while the list is empty — an empty array asserts "this person
 * exists nowhere else", which is worse than saying nothing.
 */
export function person(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: SITE_AUTHOR.name,
    url: `${SITE_ORIGIN}${SITE_AUTHOR.path}`,
    jobTitle: SITE_AUTHOR.jobTitle,
    description: SITE_AUTHOR.shortBio,
    knowsAbout: [...SITE_AUTHOR.knowsAbout],
    hasCredential: SITE_AUTHOR.credentials.map((credential) => ({
      '@type': 'EducationalOccupationalCredential',
      name: credential.label,
      ...(credential.year ? { dateCreated: String(credential.year) } : {}),
    })),
    worksFor: { '@id': `${SITE_ORIGIN}/#organization` },
    ...(SITE_AUTHOR.sameAs.length > 0 ? { sameAs: [...SITE_AUTHOR.sameAs] } : {}),
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

export interface ArticleCitation {
  title: string;
  url: string;
}

/**
 * A sourced reference page.
 *
 * `Article`, not `ScholarlyArticle`: this is a practitioner's synthesis of
 * published research, not original research, and claiming otherwise would be
 * the same overreach as calling an uncited document peer-reviewed.
 */
export function referenceArticle(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  citations: ArticleCitation[];
  about?: string[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: `${SITE_ORIGIN}${input.path}`,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: { '@id': AUTHOR_ID },
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    ...(input.about && input.about.length > 0 ? { about: input.about } : {}),
    citation: input.citations.map((citation) => ({
      '@type': 'CreativeWork',
      name: citation.title,
      url: citation.url,
    })),
  };
}

export interface HowToStep {
  name: string;
  text: string;
}

/**
 * A movement page. `HowTo` rather than `ExerciseAction` because the page is
 * instructions for performing something, which is what HowTo describes and what
 * search engines actually consume.
 */
export function howTo(input: {
  name: string;
  description: string;
  steps: HowToStep[];
  path: string;
  /** Omitted rather than emitted empty — an `image: ""` is worse than no image. */
  image?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    url: `${SITE_ORIGIN}${input.path}`,
    ...(input.image ? { image: input.image } : {}),
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    step: input.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/**
 * A workout page. `ExercisePlan` carries the two things that make an AMRAP an
 * AMRAP — a fixed duration and a repeating set of movements — so the duration
 * goes in as an ISO 8601 period rather than prose.
 */
export function exercisePlan(input: {
  name: string;
  description: string;
  durationMinutes: number;
  movements: string[];
  path: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ExercisePlan',
    name: input.name,
    description: input.description,
    url: `${SITE_ORIGIN}${input.path}`,
    activityDuration: `PT${input.durationMinutes}M`,
    exerciseType: 'AMRAP',
    workload: input.movements.join(', '),
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  };
}

/**
 * A blog post. Dates come from the export snapshot / committed MD — never
 * `Date.now()` at build time.
 */
export function blogPosting(input: {
  title: string;
  description: string;
  path: string;
  authorName: string;
  datePublished: string;
  dateModified: string;
  image?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: `${SITE_ORIGIN}${input.path}`,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    // A byline that matches the site author points at the full Person entity;
    // a guest author still gets an inline node, so the builder's free-text
    // field keeps working without a code change.
    author: isSiteAuthor(input.authorName)
      ? { '@id': AUTHOR_ID }
      : { '@type': 'Person', name: input.authorName },
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    ...(input.image ? { image: input.image } : {}),
  };
}

/** `</script>` inside a JSON string would close the tag early and inject markup. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
