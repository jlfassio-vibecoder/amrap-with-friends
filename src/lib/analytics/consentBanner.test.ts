import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountConsentBanner } from '@/lib/analytics/consentBanner';
import { readConsentState } from '@/lib/analytics/consent';

function setRegionCookie(value: string): void {
  document.cookie = `awf_consent_required=${value}; path=/`;
}

function banner(): HTMLElement | null {
  return document.getElementById('awf-consent-banner');
}

describe('mountConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.cookie = 'awf_consent_required=; path=/; max-age=0';
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('does not appear outside the gated regions', () => {
    setRegionCookie('0');
    mountConsentBanner();
    expect(banner()).toBeNull();
  });

  it('appears in a gated region and offers both answers', () => {
    setRegionCookie('1');
    mountConsentBanner();
    const buttons = [...(banner()?.querySelectorAll('button') ?? [])];
    expect(buttons.map((button) => button.textContent)).toEqual(['Decline', 'Allow']);
  });

  it('puts Decline before Allow, so refusing is not the harder path', () => {
    setRegionCookie('1');
    mountConsentBanner();
    const buttons = [...(banner()?.querySelectorAll('button') ?? [])];
    expect(buttons[0]?.textContent).toBe('Decline');
  });

  it('records a refusal, dismisses, and does not ask again', () => {
    setRegionCookie('1');
    mountConsentBanner();
    const decline = banner()?.querySelector('button');
    decline?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(readConsentState()).toBe('denied');
    expect(banner()).toBeNull();

    mountConsentBanner();
    expect(banner()).toBeNull();
  });

  it('records acceptance and reports it to the caller', () => {
    setRegionCookie('1');
    let granted: boolean | null = null;
    mountConsentBanner((value) => {
      granted = value;
    });
    const buttons = [...(banner()?.querySelectorAll('button') ?? [])];
    buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(granted).toBe(true);
    expect(readConsentState()).toBe('granted');
  });

  it('never mounts twice', () => {
    setRegionCookie('1');
    mountConsentBanner();
    mountConsentBanner();
    expect(document.querySelectorAll('#awf-consent-banner')).toHaveLength(1);
  });
});
