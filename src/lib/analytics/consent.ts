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

const CONSENT_KEY = 'amrap_consent';

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
    return stored === 'granted' || stored === 'denied' ? stored : 'unanswered';
  } catch {
    return 'unanswered';
  }
}

/** Remembering the answer is itself strictly necessary — a visitor who declines must not be asked on every page. */
export function writeConsentState(state: Exclude<ConsentState, 'unanswered'>): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
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
  if (!isConsentRequired(options?.cookieString)) {
    return true;
  }
  return (options?.state ?? readConsentState()) === 'granted';
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
