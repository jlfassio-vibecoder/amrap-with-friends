/**
 * The region half of the consent gate, kept free of any DOM reference so the
 * edge middleware can import it — middleware runs on the Vercel edge runtime,
 * whose tsconfig has no `dom` lib, and pulling in the browser-side module
 * would not compile.
 */

/** Written by the edge middleware from the request's country. Carries no identifier — it is a yes/no about the visitor's region. */
export const CONSENT_REGION_COOKIE = 'awf_consent_required';

/**
 * EEA plus the UK. Deliberately a literal list rather than a clever rule: the
 * set is small, it changes rarely, and someone auditing this needs to see
 * exactly which visitors are gated without running the code.
 */
export const CONSENT_REQUIRED_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
]);

/**
 * Unknown country gates. A missing or unreadable country is exactly the case
 * where we cannot show the visitor is outside the EEA, and the safe default
 * when you cannot tell is to ask.
 */
export function countryRequiresConsent(country: string | null | undefined): boolean {
  const code = country?.trim().toUpperCase();
  if (!code || code.length !== 2) {
    return true;
  }
  return CONSENT_REQUIRED_COUNTRIES.has(code);
}
