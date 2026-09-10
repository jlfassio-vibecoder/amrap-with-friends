import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountConsentChoices } from '@/lib/analytics/consentChoices';
import { readConsentState } from '@/lib/analytics/consent';
import { getOrCreateAnonId } from '@/lib/analytics/identity';

function setRegionCookie(value: string): void {
  document.cookie = `awf_consent_required=${value}; path=/`;
}

function mount(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  mountConsentChoices(container);
  return container;
}

function visibleButtons(container: HTMLElement): string[] {
  return [...container.querySelectorAll('button')]
    .filter((button) => !button.hidden)
    .map((button) => button.textContent ?? '');
}

describe('mountConsentChoices', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.cookie = 'awf_consent_required=; path=/; max-age=0';
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('offers an opt-out outside the gated regions, where nobody was asked', () => {
    setRegionCookie('0');
    const container = mount();
    expect(visibleButtons(container)).toEqual(['Turn off and delete the id']);
    expect(container.textContent).toContain('Analytics id: on');
  });

  it('honours a refusal outside the gated regions too', () => {
    setRegionCookie('0');
    const container = mount();
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(readConsentState()).toBe('denied');
    // The region does not decide whether we listen to an explicit no.
    expect(getOrCreateAnonId()).toBeNull();
  });

  it('deletes the id and the first-touch note when turned off', () => {
    setRegionCookie('0');
    localStorage.setItem('amrap_anon_id', 'abc');
    localStorage.setItem('amrap_first_touch', '{"channel":"direct"}');

    const container = mount();
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(localStorage.getItem('amrap_anon_id')).toBeNull();
    expect(localStorage.getItem('amrap_first_touch')).toBeNull();
  });

  it('lets a gated visitor who declined change their mind', () => {
    setRegionCookie('1');
    const container = mount();
    expect(visibleButtons(container)).toEqual(['Turn on']);

    [...container.querySelectorAll('button')]
      .find((button) => button.textContent === 'Turn on')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(readConsentState()).toBe('granted');
    expect(getOrCreateAnonId()).not.toBeNull();
    expect(visibleButtons(container)).toEqual(['Turn off and delete the id']);
  });

  it('says nothing is stored yet to a gated visitor who has not answered', () => {
    setRegionCookie('1');
    const container = mount();
    expect(container.textContent).toContain('until you choose');
  });

  it('does nothing when the container is missing', () => {
    expect(() => mountConsentChoices(null)).not.toThrow();
  });
});
