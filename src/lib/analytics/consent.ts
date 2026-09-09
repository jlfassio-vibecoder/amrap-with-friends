/**
 * Consent for identified analytics, asked only where the law requires it.
 *
 * ePrivacy / PECR Article 5(3) governs *storing or accessing information on a
 * user's device*, and is technology-neutral -- localStorage counts exactly as a
 * cookie does, so "we don't use cookies" is not an exemption. The narrow
 * audience-measurement carve-out some regulators allow does not fit this
 * product either: coach_identity_journey builds a per-person timeline and
 * analytics_identity_links ties the browser id to a named account, which is
 * individual profiling rather than aggregate statistics.
 *
 * So in gated regions nothing is written to or read from the device until the
 * visitor agrees. Everywhere else the identifier behaves as it always has --
 * that is the geo-gating, and it is why this module has three states rather
 * than a boolean: "not required" and "required but unanswered" lead to
 * opposite behaviour and must never collapse together.
 *
 * Declining is not the same as being invisible. Pageviews still report with no
 * identifier and no storage, which Article 5(3) does not reach at all, so the
 * content pages keep an honest aggregate count either way.
 */

import { CONSENT_REGION_COOKIE } from '@/lib/analytics/consentRegion';

export {
  CONSENT_REGION_COOKIE,
  CONSENT_REQUIRED_COUNTRIES,
  countryRequiresConsent,
} from '@/lib/analytics/consentRegion';

export type ConsentState = 'granted' | 'denied' | 'unanswered';

/** Everything the identified path is allowed to keep on the device. Withdrawal removes all of it. */
const IDENTIFIED_STORAGE_KEYS = ['amrap_anon_id', 'amrap_first_touch'];

/**
 * Withdrawal has to actually remove the identifier, not merely stop sending.
 * Leaving the id in place would mean a visitor who opted out is still carrying
 * the thing they objected to, ready to resume if they ever changed their mind.
 * Events already received are not undone by this, and /privacy says so.
 */
export function clearIdentifiedStorage(): void {
  for (const key of IDENTIFIED_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to clear in a browser that will not let us look */
    }
  }
}

/**
 * Run on load, before anything reads the identifier.
 *
 * A visitor in a gated region who has not granted consent should not be
 * carrying an identifier at all -- including one minted before the gate
 * existed, or under a previous consent version. Gating future reads is not
 * enough on its own: the id is already on their device, and leaving it there
 * until they happen to answer is the state they have not agreed to.
 *
 * Deliberately not called for an ungated visitor who simply has not opted out.
 */
export function enforceConsentBoundary(): void {
  if (isConsentRequired() && readConsentState() !== 'granted') {
    clearIdentifiedStorage();
  }
}

/** The one entry point for a decision, from the banner or from /privacy. */
export function setConsentDecision(granted: boolean): void {
  writeConsentState(granted ? 'granted' : 'denied');
  if (!granted) {
    clearIdentifiedStorage();
  }
}

const CONSENT_KEY = 'amrap_consent';

/**
 * Bump to re-ask everyone.
 *
 * A stored answer is only valid for the terms it was given under, so when what
 * we do with the identifier changes, the old yes does not carry over. A stored
 * value without a version predates versioning and is treated as unanswered --
 * which is also how the first visitors after the gate ships are re-asked.
 */
export const CONSENT_VERSION = 1;

/** Reads the middleware's cookie. Absent means gate: a stripped or blocked cookie must not silently open tracking. */
export function isConsentRequired(cookieString?: string): boolean {
  const source = cookieString ?? (typeof document === 'undefined' ? '' : document.cookie);
  const match = source.match(new RegExp(`(?:^|;\\s*)${CONSENT_REGION_COOKIE}=([^;]*)`));
  if (!match) {
    return true;
  }
  return match[1] !== '0';
}

export function readConsentState(): ConsentState {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      return 'unanswered';
    }
    const [state, version] = stored.split(':');
    if (Number(version) !== CONSENT_VERSION) {
      return 'unanswered';
    }
    return state === 'granted' || state === 'denied' ? state : 'unanswered';
  } catch {
    return 'unanswered';
  }
}

/** Remembering the answer is itself strictly necessary — a visitor who declines must not be asked on every page. */
export function writeConsentState(state: Exclude<ConsentState, 'unanswered'>): void {
  try {
    localStorage.setItem(CONSENT_KEY, `${state}:${CONSENT_VERSION}`);
  } catch {
    /* a browser that cannot remember the answer will simply ask again */
  }
}

/**
 * The single question everything else asks. False means no device storage and
 * no identifier — not merely "do not send events".
 */
export function canUseIdentifiedAnalytics(options?: {
  cookieString?: string;
  state?: ConsentState;
}): boolean {
  const state = options?.state ?? readConsentState();
  // An explicit refusal is honoured everywhere, not only where the law
  // compels it. Someone outside the EEA who turns this off on /privacy has
  // said the same thing as someone inside it, and the region has no bearing
  // on whether we listen.
  if (state === 'denied') {
    return false;
  }
  if (!isConsentRequired(options?.cookieString)) {
    return true;
  }
  return state === 'granted';
}

/** Whether to put the banner in front of this visitor. */
export function shouldAskForConsent(options?: {
  cookieString?: string;
  state?: ConsentState;
}): boolean {
  if (!isConsentRequired(options?.cookieString)) {
    return false;
  }
  return (options?.state ?? readConsentState()) === 'unanswered';
}
