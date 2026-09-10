import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  canUseIdentifiedAnalytics,
  enforceConsentBoundary,
  countryRequiresConsent,
  isConsentRequired,
  readConsentState,
  shouldAskForConsent,
  writeConsentState,
} from '@/lib/analytics/consent';
import { getOrCreateAnonId } from '@/lib/analytics/identity';

function setRegionCookie(value: string | null): void {
  if (value === null) {
    document.cookie = 'awf_consent_required=; path=/; max-age=0';
    return;
  }
  document.cookie = `awf_consent_required=${value}; path=/`;
}

describe('countryRequiresConsent', () => {
  it('gates the EEA and the UK', () => {
    expect(countryRequiresConsent('DE')).toBe(true);
    expect(countryRequiresConsent('fr')).toBe(true);
    expect(countryRequiresConsent('GB')).toBe(true);
    expect(countryRequiresConsent('NO')).toBe(true);
  });

  it('does not gate elsewhere', () => {
    expect(countryRequiresConsent('US')).toBe(false);
    expect(countryRequiresConsent('CA')).toBe(false);
    expect(countryRequiresConsent('AU')).toBe(false);
  });

  it('gates when the country is unknown', () => {
    // We cannot show the visitor is outside the EEA, so we ask.
    expect(countryRequiresConsent(null)).toBe(true);
    expect(countryRequiresConsent('')).toBe(true);
    expect(countryRequiresConsent('XX!')).toBe(true);
  });
});

describe('isConsentRequired', () => {
  it('reads the middleware cookie', () => {
    expect(isConsentRequired('awf_consent_required=0')).toBe(false);
    expect(isConsentRequired('awf_consent_required=1')).toBe(true);
  });

  it('gates when the cookie is absent, stripped or malformed', () => {
    // A missing cookie must never silently open tracking.
    expect(isConsentRequired('')).toBe(true);
    expect(isConsentRequired('other=1')).toBe(true);
  });

  it('is not fooled by a cookie whose name merely ends the same way', () => {
    expect(isConsentRequired('not_awf_consent_required=0')).toBe(true);
  });

  it('finds the cookie among others', () => {
    expect(isConsentRequired('theme=dark; awf_consent_required=0; other=x')).toBe(false);
  });
});

describe('the gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setRegionCookie(null);
    localStorage.clear();
  });

  it('lets an ungated visitor through without asking', () => {
    setRegionCookie('0');
    expect(canUseIdentifiedAnalytics()).toBe(true);
    expect(shouldAskForConsent()).toBe(false);
  });

  it('asks, and withholds the identifier, in a gated region', () => {
    setRegionCookie('1');
    expect(shouldAskForConsent()).toBe(true);
    expect(canUseIdentifiedAnalytics()).toBe(false);
  });

  it('never touches the device before consent is given', () => {
    // The point of Article 5(3) is the storage access itself, not the report.
    setRegionCookie('1');
    expect(getOrCreateAnonId()).toBeNull();
    expect(localStorage.getItem('amrap_anon_id')).toBeNull();
  });

  it('mints an id once consent is granted, and stops asking', () => {
    setRegionCookie('1');
    writeConsentState('granted');
    expect(readConsentState()).toBe('granted');
    expect(shouldAskForConsent()).toBe(false);
    expect(getOrCreateAnonId()).not.toBeNull();
  });

  it('keeps the device untouched after a refusal, and stops asking', () => {
    setRegionCookie('1');
    writeConsentState('denied');
    expect(shouldAskForConsent()).toBe(false);
    expect(canUseIdentifiedAnalytics()).toBe(false);
    expect(getOrCreateAnonId()).toBeNull();
    expect(localStorage.getItem('amrap_anon_id')).toBeNull();
  });
});

describe('re-asking existing visitors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setRegionCookie(null);
    localStorage.clear();
  });

  it('removes an identifier minted before the gate existed', () => {
    // The pre-gate case: an EEA visitor already carrying an id and no stored
    // answer. Gating future reads is not enough -- the id is on their device.
    setRegionCookie('1');
    localStorage.setItem('amrap_anon_id', 'pre-existing-id');
    localStorage.setItem('amrap_first_touch', '{"channel":"organic_search"}');

    enforceConsentBoundary();

    expect(localStorage.getItem('amrap_anon_id')).toBeNull();
    expect(localStorage.getItem('amrap_first_touch')).toBeNull();
    expect(shouldAskForConsent()).toBe(true);
  });

  it('leaves a granted visitor alone', () => {
    setRegionCookie('1');
    writeConsentState('granted');
    localStorage.setItem('amrap_anon_id', 'kept');

    enforceConsentBoundary();

    expect(localStorage.getItem('amrap_anon_id')).toBe('kept');
  });

  it('does not clear an ungated visitor who simply has not opted out', () => {
    setRegionCookie('0');
    localStorage.setItem('amrap_anon_id', 'kept');

    enforceConsentBoundary();

    expect(localStorage.getItem('amrap_anon_id')).toBe('kept');
  });

  it('re-asks when the consent version moves on', () => {
    setRegionCookie('1');
    localStorage.setItem('amrap_consent', `granted:${CONSENT_VERSION - 1}`);

    // A yes given under different terms is not a yes to these.
    expect(readConsentState()).toBe('unanswered');
    expect(shouldAskForConsent()).toBe(true);
    expect(canUseIdentifiedAnalytics()).toBe(false);
  });

  it('treats an unversioned stored answer as unanswered', () => {
    setRegionCookie('1');
    localStorage.setItem('amrap_consent', 'granted');

    expect(readConsentState()).toBe('unanswered');
  });

  it('round-trips a decision at the current version', () => {
    setRegionCookie('1');
    writeConsentState('granted');
    expect(localStorage.getItem('amrap_consent')).toBe(`granted:${CONSENT_VERSION}`);
    expect(readConsentState()).toBe('granted');
  });
});
