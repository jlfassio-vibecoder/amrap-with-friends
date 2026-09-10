/**
 * Conservative social-growth estimate for the creators recruiting page.
 *
 * Platforms do not publish an official Live → follow conversion. Rates below
 * are industry planning floors (Live) or labeled product assumptions (cards).
 * Change them here so the island and “Show the math” cannot drift.
 */

/** Concurrent Live viewers as a share of followers — low end of the common 2–5% IG Live band. */
export const LIVE_REACH_RATE = 0.02;
/** Live viewer → new follow — floor of healthy 3–5% Live conversion targets. */
export const LIVE_FOLLOW_RATE = 0.03;
/** Share of room athletes who post the finish card — product assumption. */
export const CARD_POST_RATE = 0.25;
/**
 * Views per posted card — ~800 athlete audience × 5% organic reach.
 * Product assumption; not a platform-published figure.
 */
export const VIEWS_PER_CARD_POST = 40;
/** Card viewer → follow tagged host — cold UGC/tag; kept below Live CTA rates. */
export const CARD_FOLLOW_RATE = 0.01;
export const WEEKS_PER_YEAR = 52;

export interface SocialGrowthInput {
  followers: number;
  missionsPerWeek: number;
  athletesPerRoom: number;
}

export interface SocialGrowthResult {
  liveViewersPerWeek: number;
  cardViewsPerWeek: number;
  followsFromLivePerWeek: number;
  followsFromCardsPerWeek: number;
  followsPerWeek: number;
  followsPerYear: number;
  /** Year-one lift as a fraction of the starting follower base (0–1). */
  yearLiftRate: number;
}

export function estimateSocialGrowth(input: SocialGrowthInput): SocialGrowthResult {
  const liveViewersPerMission = input.followers * LIVE_REACH_RATE;
  const liveViewersPerWeek = liveViewersPerMission * input.missionsPerWeek;
  const followsFromLivePerWeek = liveViewersPerWeek * LIVE_FOLLOW_RATE;

  const cardsPostedPerMission = input.athletesPerRoom * CARD_POST_RATE;
  const cardViewsPerWeek = cardsPostedPerMission * VIEWS_PER_CARD_POST * input.missionsPerWeek;
  const followsFromCardsPerWeek = cardViewsPerWeek * CARD_FOLLOW_RATE;

  const followsPerWeek = followsFromLivePerWeek + followsFromCardsPerWeek;
  const followsPerYear = followsPerWeek * WEEKS_PER_YEAR;
  const yearLiftRate = input.followers > 0 ? followsPerYear / input.followers : 0;

  return {
    liveViewersPerWeek,
    cardViewsPerWeek,
    followsFromLivePerWeek,
    followsFromCardsPerWeek,
    followsPerWeek,
    followsPerYear,
    yearLiftRate,
  };
}

export function formatFollows(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
