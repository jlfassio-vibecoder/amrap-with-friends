import { shouldAskForConsent, writeConsentState } from '@/lib/analytics/consent';

/**
 * One banner for both surfaces.
 *
 * Written in plain DOM rather than React because the Astro content pages have
 * no React runtime, and a second implementation there is how the two would
 * drift on what the visitor was actually told. The SPA mounts it through the
 * same function.
 *
 * Uses the design tokens from src/index.css, which Astro already imports, so
 * it inherits the product's colours in both themes without hard-coding any.
 */

const CONTAINER_ID = 'awf-consent-banner';

export function mountConsentBanner(onDecision?: (granted: boolean) => void): void {
  if (typeof document === 'undefined' || document.getElementById(CONTAINER_ID)) {
    return;
  }
  if (!shouldAskForConsent()) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = CONTAINER_ID;
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-label', 'Analytics choice');
  banner.className =
    'fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface px-4 py-3 text-sm text-ink shadow-lg';

  const inner = document.createElement('div');
  inner.className =
    'mx-auto flex w-full max-w-[52rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';

  const copy = document.createElement('p');
  copy.className = 'text-sm leading-[1.6] text-secondary';
  // Says what it actually does. "We value your privacy" tells the reader
  // nothing they can act on, and the honest version is barely longer.
  copy.textContent =
    'We can keep a random id on this device to see which pages lead people to train. It is not your name and we do not use it for advertising. Decline and we only count the page, with nothing stored.';

  const actions = document.createElement('div');
  actions.className = 'flex shrink-0 gap-2';

  function decide(granted: boolean): void {
    writeConsentState(granted ? 'granted' : 'denied');
    banner.remove();
    onDecision?.(granted);
  }

  // Decline first in the DOM and visually equal in weight: a refusal that is
  // harder to reach than acceptance is not freely given consent.
  const decline = document.createElement('button');
  decline.type = 'button';
  decline.className = 'btn-outline text-sm';
  decline.textContent = 'Decline';
  decline.addEventListener('click', () => decide(false));

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'btn-primary text-sm';
  accept.textContent = 'Allow';
  accept.addEventListener('click', () => decide(true));

  actions.append(decline, accept);
  inner.append(copy, actions);
  banner.append(inner);
  document.body.append(banner);
}
