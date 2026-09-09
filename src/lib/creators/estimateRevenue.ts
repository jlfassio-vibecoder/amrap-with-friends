/**
 * Conservative revenue estimate for the creators / coach recruiting page.
 * Rates and conversion assumptions are product copy — change them here so the
 * island and the "show the math" panel cannot drift.
 */

export interface CreatorTier {
  name: string;
  /** First-12-months share of net revenue (0–1). */
  share: number;
  /** Renewal share after year one (0–1). */
  renew: number;
  /** Paid subscribers in a rolling 12 months to qualify. */
  min: number;
  desc: string;
  qual: string;
}

export const CREATOR_TIERS: readonly CreatorTier[] = [
  {
    name: 'Starter',
    share: 0.25,
    renew: 0.1,
    min: 0,
    desc: 'of net revenue on every subscription your squad buys, for their first 12 months. 10% on renewals after that.',
    qual: 'Where everyone starts. Founding hosts begin at Builder rates.',
  },
  {
    name: 'Builder',
    share: 0.3,
    renew: 0.15,
    min: 25,
    desc: "of net revenue for each subscriber's first 12 months, 15% on renewals. Plus a custom /@handle landing page and early access to new features.",
    qual: '25 paid subscribers in a rolling 12 months. Founding hosts start here.',
  },
  {
    name: 'Partner',
    share: 0.35,
    renew: 0.2,
    min: 100,
    desc: 'of net revenue for the first 12 months, 20% on renewals. Co-branded missions on the AMRAP With Friends channels and a quarterly planning call.',
    qual: '100 paid subscribers in a rolling 12 months.',
  },
  {
    name: 'Anchor',
    share: 0.4,
    renew: 0.25,
    min: 300,
    desc: 'of net revenue for the first 12 months, 25% on renewals. Terms negotiated individually.',
    qual: '300 paid subscribers in a rolling 12 months.',
  },
] as const;

/** Blended net per subscription after squad discount and card fees. */
export const NET_PER_SUB = 50;
/** Share of guests who save the mission to an account. */
export const CLAIM_RATE = 0.2;
/** Share of savers who go paid within 60 days. */
export const PAID_RATE = 0.07;
/** Average weeks per calendar month. */
export const WEEKS_PER_MONTH = 4.3;

export interface EstimateInput {
  missionsPerWeek: number;
  athletesPerRoom: number;
}

export interface EstimateResult {
  paidYear: number;
  yearEarnings: number;
  month12Earnings: number;
  /** Index into CREATOR_TIERS; founding hosts floor at Builder (1). */
  autoTierIndex: number;
}

/**
 * Founding hosts start at Builder. Partner/Anchor apply once the year-one
 * paid-subscriber estimate crosses the tier threshold.
 */
export function autoTierIndex(paidYear: number): number {
  if (paidYear >= CREATOR_TIERS[3]!.min) return 3;
  if (paidYear >= CREATOR_TIERS[2]!.min) return 2;
  return 1;
}

export function estimateRevenue(input: EstimateInput): EstimateResult {
  const athletesPerMonth = input.missionsPerWeek * WEEKS_PER_MONTH * input.athletesPerRoom;
  const paidPerMonth = athletesPerMonth * CLAIM_RATE * PAID_RATE;
  const paidYear = Math.round(paidPerMonth * 12);
  const tierIdx = autoTierIndex(paidYear);
  const share = CREATOR_TIERS[tierIdx]!.share;
  return {
    paidYear,
    yearEarnings: paidYear * NET_PER_SUB * share,
    month12Earnings: paidPerMonth * NET_PER_SUB * share,
    autoTierIndex: tierIdx,
  };
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
