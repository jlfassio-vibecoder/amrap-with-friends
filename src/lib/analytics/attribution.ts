import { canUseIdentifiedAnalytics } from '@/lib/analytics/consent';

/**
 * Where a visitor came from, captured once and kept.
 *
 * Nothing in the app has ever recorded a referrer or a campaign tag, so the
 * whole SEO and content investment -- the Astro pages, the sitemap, the
 * generated exercise and workout pages -- has had no feedback loop. This is
 * the capture half; report_acquisition joins it to sign-ups and missions.
 *
 * First touch, not last: the question is which channel *found* this person,
 * and by the time they sign up the referrer is usually our own domain.
 */

export type AcquisitionChannel =
  'direct' | 'organic_search' | 'social' | 'referral' | 'internal' | 'campaign';

export interface Attribution {
  channel: AcquisitionChannel;
  /** Referrer host, or the utm_source when one was given. Never a full URL — see capture note below. */
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPath: string;
  capturedAt: string;
}

const SEARCH_HOSTS = [
  'google.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'ecosia.',
  'brave.',
  'startpage.',
  'baidu.',
  'yandex.',
];

const SOCIAL_HOSTS = [
  'facebook.',
  'instagram.',
  'twitter.',
  'x.com',
  't.co',
  'reddit.',
  'linkedin.',
  'youtube.',
  'tiktok.',
  'pinterest.',
  'threads.',
  'whatsapp.',
  'discord.',
];

function hostMatches(host: string, needles: string[]): boolean {
  return needles.some(
    (needle) => host === needle || host.startsWith(needle) || host.includes(`.${needle}`)
  );
}

/** Host only, lowercased, `www.` stripped. Never the path or query: another site's URL can carry their user's personal data, and we have no business storing it. */
export function referrerHost(referrer: string): string | null {
  const trimmed = referrer.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function classifyReferrer(referrer: string, currentHost: string): AcquisitionChannel {
  const host = referrerHost(referrer);
  if (!host) {
    return 'direct';
  }
  const self = currentHost.toLowerCase().replace(/^www\./, '');
  if (host === self) {
    // Our own Astro content pages share this origin, so a click from
    // /amrap-timer into the app is navigation, not acquisition. Counting it
    // as a referral would let the site take credit for its own traffic.
    return 'internal';
  }
  if (hostMatches(host, SEARCH_HOSTS)) {
    return 'organic_search';
  }
  if (hostMatches(host, SOCIAL_HOSTS)) {
    return 'social';
  }
  return 'referral';
}

/** Only the three utm keys we act on, each length-capped. An allowlist because a query string is attacker-controlled and ends up in a coach's browser. */
export function parseUtm(search: string): {
  source: string | null;
  medium: string | null;
  campaign: string | null;
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const read = (key: 'utm_source' | 'utm_medium' | 'utm_campaign'): string | null => {
    const value = params.get(key)?.trim().toLowerCase() ?? '';
    return value ? value.slice(0, 64) : null;
  };
  return {
    source: read('utm_source'),
    medium: read('utm_medium'),
    campaign: read('utm_campaign'),
  };
}

export function buildAttribution(input: {
  referrer: string;
  search: string;
  pathname: string;
  host: string;
  now?: Date;
}): Attribution {
  const utm = parseUtm(input.search);
  const referred = classifyReferrer(input.referrer, input.host);
  // An explicit campaign tag wins over the referrer: it is the one signal
  // someone deliberately attached, and a tagged link clicked from anywhere
  // still belongs to that campaign.
  const channel: AcquisitionChannel = utm.source || utm.campaign ? 'campaign' : referred;
  return {
    channel,
    source: utm.source ?? referrerHost(input.referrer),
    medium: utm.medium,
    campaign: utm.campaign,
    landingPath: input.pathname.slice(0, 200),
    capturedAt: (input.now ?? new Date()).toISOString(),
  };
}

/**
 * Worth recording? Internal navigation and an untagged direct hit on a page
 * the visitor has already been attributed for say nothing, and at one write
 * per route change they would swamp the table.
 */
export function isAttributable(attribution: Attribution): boolean {
  return attribution.channel !== 'internal';
}

const STORAGE_KEY = 'amrap_first_touch';

export function readStoredAttribution(): Attribution | null {
  if (!canUseIdentifiedAnalytics()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const value = parsed as Partial<Attribution>;
    return typeof value.channel === 'string' && typeof value.capturedAt === 'string'
      ? (value as Attribution)
      : null;
  } catch {
    // Private windows and blocked site data throw on access, and a corrupt
    // value must not take the app down on boot.
    return null;
  }
}

export function persistAttribution(attribution: Attribution): void {
  // First touch is a durable record of where one person came from — the same
  // Article 5(3) storage the browser id is, and gated the same way.
  if (!canUseIdentifiedAnalytics()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    /* first touch is best-effort — never break the app to record it */
  }
}
