import type { HudCoreDomain, HudDomainMinutes } from '@/lib/hud/types';
import { formatCapRange } from '@/lib/timeDomains';

export type LoadImbalanceResult =
  | { imbalanced: false }
  | { imbalanced: true; dominant: HudCoreDomain; share: number; warning: string };

const CORE_DOMAINS: HudCoreDomain[] = [5, 10, 15, 20];

// The minute in each of these used to be the only clock its domain had. Now it
// is one of several, so the nag names the range an athlete can actually pick —
// telling someone a 20-minute Marathon is required when an 18 would clear the
// same warning is the kind of small lie that stops people trusting the HUD.
const WARNING_BY_DOMAIN: Record<HudCoreDomain, string> = {
  5: `System Warning: Imbalanced Load. ${formatCapRange(20)}-Minute Marathon required.`,
  10: `System Warning: Imbalanced Load. Extend the domain. ${formatCapRange(15)}-Minute Grind required.`,
  15: 'System Warning: Imbalanced Load. You are hiding in the Grind. Sprint or Marathon required.',
  20: `System Warning: Imbalanced Load. You never touch the redline. ${formatCapRange(5)}-Minute Sprint required.`,
};

export function evaluateLoadImbalance(domainMinutes: HudDomainMinutes): LoadImbalanceResult {
  const coreTotal = domainMinutes[5] + domainMinutes[10] + domainMinutes[15] + domainMinutes[20];

  if (coreTotal <= 0) {
    return { imbalanced: false };
  }

  let dominant: HudCoreDomain = 5;
  let maxMinutes = domainMinutes[5];

  for (const domain of CORE_DOMAINS) {
    const minutes = domainMinutes[domain];
    if (minutes > maxMinutes || (minutes === maxMinutes && domain < dominant)) {
      maxMinutes = minutes;
      dominant = domain;
    }
  }

  const ratio = maxMinutes / coreTotal;
  if (ratio <= 0.6) {
    return { imbalanced: false };
  }

  const share = Math.round(ratio * 1000) / 10;

  return {
    imbalanced: true,
    dominant,
    share,
    warning: WARNING_BY_DOMAIN[dominant],
  };
}
