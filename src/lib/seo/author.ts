import { SITE_ORIGIN } from '@/lib/seo/routes';

/**
 * The site's author, as one entity.
 *
 * Articles carry a free-text `authorDisplayName`, which is right for the
 * builder — a guest author should not need a code change. But a byline that is
 * only a string is an unverifiable assertion: schema.org gets an anonymous
 * `Person` node with a name and nothing else, and nothing connects the person in
 * the byline to the person with the reviews and the companies.
 *
 * This is that connection. When an article's author matches the name below, the
 * `BlogPosting` points at this entity by `@id` instead of inlining a bare name,
 * and `sameAs` gives an assistant somewhere to corroborate the claims.
 */
export const AUTHOR_PATH = '/authors/justin-fassio';
export const AUTHOR_ID = `${SITE_ORIGIN}${AUTHOR_PATH}#person`;

export interface AuthorCredential {
  label: string;
  /** Omitted when we do not have it. Never guessed — a wrong year is worse than none. */
  year?: number;
}

export const SITE_AUTHOR = {
  name: 'Justin Fassio',
  path: AUTHOR_PATH,
  jobTitle: 'Fitness programmer and founder',
  shortBio:
    'Certified Master Fitness Trainer since 1998. Owned San Diego Core Fitness, co-founded gymgo and aiworkoutgenerator.com, and builds AMRAP With Friends.',
  credentials: [
    { label: 'Master Fitness Trainer', year: 1998 },
    { label: "Commander's Total Fitness Program Manager", year: 1998 },
  ] satisfies AuthorCredential[],
  ventures: [
    { name: 'San Diego Core Fitness', role: 'Owner' },
    { name: 'gymgo', role: 'Co-founder' },
    { name: 'aiworkoutgenerator.com', role: 'Co-founder' },
    { name: 'AMRAP With Friends', role: 'Founder' },
  ],
  knowsAbout: [
    'AMRAP training',
    'Bodyweight conditioning',
    'Fitness programming',
    'Military physical training',
    'Group fitness',
  ],
  /**
   * Profiles that corroborate the claims above — the Yelp listing for San Diego
   * Core Fitness, LinkedIn, gymgo, aiworkoutgenerator.com.
   *
   * Deliberately empty. `sameAs` is the field that turns a credential from an
   * assertion into something an assistant can verify, so a wrong URL here is
   * worse than none: fill it with the real ones. The author page renders the
   * "Elsewhere" section only when this has entries.
   */
  sameAs: [] as string[],
} as const;

/** Free-text author names come from the builder, so compare them loosely. */
export function isSiteAuthor(name: string): boolean {
  return name.trim().toLowerCase() === SITE_AUTHOR.name.toLowerCase();
}
