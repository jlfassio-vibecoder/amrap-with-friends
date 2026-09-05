import type { CoachArticleStatus, CoachArticleSummary } from '@/lib/api/coachArticles';
import type { ArticleArchetypeId, ArticleCategoryId } from './taxonomy';
import { slugifyArticleTitle } from './slugify';

export const DEFAULT_ARTICLE_AUTHOR = 'Justin Fassio';
export const REFRESH_STALE_MONTHS = 3;
export const WRITE_NEXT_LIMIT = 6;

export type ArticleStarter = {
  id: number;
  title: string;
  suggestedSlug: string;
  categoryId: ArticleCategoryId;
  archetypeId: ArticleArchetypeId;
  /** One-line angle from the brief — not a body draft. */
  angleHint: string;
  seasonal: boolean;
  trainingTogetherWedge: boolean;
};

type StarterSeed = Omit<ArticleStarter, 'suggestedSlug'>;

const SEEDS: StarterSeed[] = [
  {
    id: 1,
    title: 'What 150 AMRAP Workouts Reveal About Programming',
    categoryId: 'the-data',
    archetypeId: 'data-story',
    angleHint:
      'Round density roughly doubles from 5 to 20 minutes — different sports, same format.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 2,
    title: 'The 12-Minute AMRAP for a Lunch Break',
    categoryId: 'programming',
    archetypeId: 'specific-scenario',
    angleHint: 'A real 30-minute window including changing; why 12 minutes is a useful cap.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 3,
    title: 'How to Work Out With a Friend in Another Time Zone',
    categoryId: 'training-together',
    archetypeId: 'specific-scenario',
    angleHint: 'What breaks remotely, the fallback, and what a shared clock changes.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
  {
    id: 4,
    title: "Why We Won't Tell You What a Good AMRAP Score Is",
    categoryId: 'pacing-scoring',
    archetypeId: 'opinion-pov',
    angleHint:
      'Published “good scores” are workout-specific or invented; three useful comparisons.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 5,
    title: 'Hotel Room AMRAPs: 5 Workouts for Two Square Metres',
    categoryId: 'programming',
    archetypeId: 'specific-scenario',
    angleHint: 'No jumping, no space, no kit, quiet — five library workouts that qualify.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 6,
    title: 'Air Squats Are in 1 in 6 AMRAPs. Most People Waste Them',
    categoryId: 'movement',
    archetypeId: 'teardown',
    angleHint: 'Lead with the 16.7% library figure, then failure modes under a long cap.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 7,
    title: 'Training Through December Without Losing the Habit',
    categoryId: 'programming',
    archetypeId: 'seasonal-timely',
    angleHint: 'December wrecks consistency, not fitness — a 10-minute floor you actually hit.',
    seasonal: true,
    trainingTogetherWedge: false,
  },
  {
    id: 8,
    title: 'The Travel AMRAP: Training in an Airport Hotel',
    categoryId: 'programming',
    archetypeId: 'specific-scenario',
    angleHint: 'Jet lag, no kit, twenty minutes between landing and dinner.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 9,
    title: 'Restarting in January Without Wrecking Week One',
    categoryId: 'programming',
    archetypeId: 'seasonal-timely',
    angleHint: 'Against the week-one blowout; January is the month to set a benchmark.',
    seasonal: true,
    trainingTogetherWedge: false,
  },
  {
    id: 10,
    title: 'Build an 8-Week Campaign Around One Benchmark',
    categoryId: 'training-together',
    archetypeId: 'teardown',
    angleHint: 'Benchmark, retests, easy days — walk through real product campaign behaviour.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
  {
    id: 11,
    title: 'The First 90 Seconds: Reading Your Own Pace',
    categoryId: 'pacing-scoring',
    archetypeId: 'teardown',
    angleHint: 'Pace Variance Index in depth: formula, bands, why round one is excluded.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 12,
    title: 'AMRAP Workouts for Two People and One Mat',
    categoryId: 'training-together',
    archetypeId: 'specific-scenario',
    angleHint: 'Partner formats and why AMRAP survives a fitness gap better than time-caps.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
  {
    id: 13,
    title: 'Testing Season: How to Peak for a Benchmark Retest',
    categoryId: 'pacing-scoring',
    archetypeId: 'seasonal-timely',
    angleHint: 'Sleep, easy day, warm-up for a test, go at the planned pace not the room’s.',
    seasonal: true,
    trainingTogetherWedge: false,
  },
  {
    id: 14,
    title: 'Push-Up Variations Ranked by How They Fail',
    categoryId: 'movement',
    archetypeId: 'teardown',
    angleHint: 'Rank variants by fatigue failure mode, not by difficulty — link the library.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 15,
    title: 'The Case Against the Live Leaderboard',
    categoryId: 'training-together',
    archetypeId: 'opinion-pov',
    angleHint: 'Argue against our own feature: when to ignore it, and why we built it anyway.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
  {
    id: 16,
    title: 'How Long Should an AMRAP Be? The Honest Answer',
    categoryId: 'programming',
    archetypeId: 'teardown',
    angleHint: 'Duration data, then the real answer: the cap you finish honestly.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 17,
    title: "Bodyweight AMRAPs That Don't Need a Single Burpee",
    categoryId: 'programming',
    archetypeId: 'specific-scenario',
    angleHint: 'Train around a movement you hate or cannot do — without moralising.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 18,
    title: "What Round Splits Say That Your Score Doesn't",
    categoryId: 'the-data',
    archetypeId: 'data-story',
    angleHint: 'Blocked on real recorded data — do not invent the numbers.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 19,
    title: 'Summer AMRAPs You Can Do in a Garden',
    categoryId: 'programming',
    archetypeId: 'seasonal-timely',
    angleHint: 'Grass, heat, no floor — seasonal; index before summer.',
    seasonal: true,
    trainingTogetherWedge: false,
  },
  {
    id: 20,
    title: 'Training With Friends Who Are Fitter Than You',
    categoryId: 'training-together',
    archetypeId: 'opinion-pov',
    angleHint: 'AMRAP survives a fitness gap; compare improvement rates, not raw scores.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
  {
    id: 21,
    title: 'The Movements That Show Up in Every AMRAP',
    categoryId: 'the-data',
    archetypeId: 'data-story',
    angleHint: 'Library frequency: air squats, jumping jacks, and a long tail of one-offs.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 22,
    title: 'Scaling an AMRAP Without Making It Pointless',
    categoryId: 'movement',
    archetypeId: 'teardown',
    angleHint: 'Volume is the lever on bodyweight work; when scaling kills the stimulus.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 23,
    title: 'The 20-Minute AMRAP Is a Pacing Test in Disguise',
    categoryId: 'programming',
    archetypeId: 'teardown',
    angleHint: 'Prove the duration-page thesis that a long AMRAP is mostly a pacing test.',
    seasonal: false,
    trainingTogetherWedge: false,
  },
  {
    id: 24,
    title: 'One Year of Group AMRAPs: What We Learned',
    categoryId: 'training-together',
    archetypeId: 'data-story',
    angleHint: 'Anniversary retrospective — real numbers if they exist, honesty if not.',
    seasonal: false,
    trainingTogetherWedge: true,
  },
];

/** Canonical starter checklist from docs/epics/blog-authoring.md (24 posts). */
export const ARTICLE_STARTERS: ArticleStarter[] = SEEDS.map((seed) => ({
  ...seed,
  suggestedSlug: slugifyArticleTitle(seed.title),
}));

export type StarterMatch = {
  starter: ArticleStarter;
  article: Pick<CoachArticleSummary, 'id' | 'title' | 'slug' | 'status'> | null;
};

export type CadenceArticleRef = {
  id: string;
  title: string;
  slug: string;
  status: CoachArticleStatus;
  publishedAt: string | null;
  modifiedAt: string | null;
};

export function matchStarterToArticles(
  starters: ArticleStarter[],
  articles: Array<Pick<CoachArticleSummary, 'id' | 'title' | 'slug' | 'status'>>
): StarterMatch[] {
  const bySlug = new Map<string, Pick<CoachArticleSummary, 'id' | 'title' | 'slug' | 'status'>>();
  for (const article of articles) {
    const key = article.slug.trim().toLowerCase();
    if (key && !bySlug.has(key)) {
      bySlug.set(key, article);
    }
  }
  return starters.map((starter) => ({
    starter,
    article: bySlug.get(starter.suggestedSlug) ?? null,
  }));
}

/** Unmatched starters in calendar order, capped for the Write-next panel. */
export function nextStartersToWrite(
  matches: StarterMatch[],
  limit: number = WRITE_NEXT_LIMIT
): StarterMatch[] {
  return matches.filter((m) => m.article === null).slice(0, limit);
}

function monthsAgoIso(now: Date, months: number): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function freshnessInstant(article: CadenceArticleRef): Date | null {
  const raw = article.modifiedAt?.trim() || article.publishedAt?.trim() || '';
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Published posts whose freshness date is older than `months` (default 3). */
export function stalePublishedArticles<T extends CadenceArticleRef>(
  articles: T[],
  now: Date = new Date(),
  months: number = REFRESH_STALE_MONTHS
): T[] {
  const cutoff = monthsAgoIso(now, months);
  return articles
    .filter((article) => article.status === 'published')
    .filter((article) => {
      const when = freshnessInstant(article);
      return when !== null && when.getTime() < cutoff.getTime();
    })
    .sort((a, b) => {
      const aTime = freshnessInstant(a)?.getTime() ?? 0;
      const bTime = freshnessInstant(b)?.getTime() ?? 0;
      return aTime - bTime;
    });
}

function sameUtcMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

export type MonthlyCadenceCounts = {
  publishedThisMonth: number;
  refreshesThisMonth: number;
};

/**
 * Informational counters for the cadence panel.
 * Refresh = published, modifiedAt in the current UTC month, and modifiedAt > publishedAt.
 */
export function monthlyCadenceCounts(
  articles: CadenceArticleRef[],
  now: Date = new Date()
): MonthlyCadenceCounts {
  let publishedThisMonth = 0;
  let refreshesThisMonth = 0;
  for (const article of articles) {
    if (article.status !== 'published') {
      continue;
    }
    const publishedAt = article.publishedAt?.trim() ?? '';
    const modifiedAt = article.modifiedAt?.trim() ?? '';
    if (publishedAt && sameUtcMonth(publishedAt, now)) {
      publishedThisMonth += 1;
    }
    if (
      publishedAt &&
      modifiedAt &&
      sameUtcMonth(modifiedAt, now) &&
      new Date(modifiedAt).getTime() > new Date(publishedAt).getTime()
    ) {
      refreshesThisMonth += 1;
    }
  }
  return { publishedThisMonth, refreshesThisMonth };
}

export type ArticleInitialDraft = {
  title: string;
  slug: string;
  category: ArticleCategoryId;
  archetype: ArticleArchetypeId;
  authorDisplayName: string;
};

export function initialDraftFromStarter(starter: ArticleStarter): ArticleInitialDraft {
  return {
    title: starter.title,
    slug: starter.suggestedSlug,
    category: starter.categoryId,
    archetype: starter.archetypeId,
    authorDisplayName: DEFAULT_ARTICLE_AUTHOR,
  };
}
