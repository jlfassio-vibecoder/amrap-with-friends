import {
  canUseIdentifiedAnalytics,
  isConsentRequired,
  readConsentState,
  setConsentDecision,
  type ConsentState,
} from '@/lib/analytics/consent';

/**
 * The control on /privacy that lets someone change their mind.
 *
 * Withdrawal has to be as easy as agreeing was, and the banner only ever
 * appears once — so without this, a decision made in a hurry was permanent.
 * It is offered to everyone, not only to visitors in gated regions: someone
 * outside the EEA has the same right to say no, they just are not asked
 * unprompted.
 *
 * Plain DOM for the same reason as the banner: /privacy is a static Astro
 * page with no React runtime.
 */

function describeState(state: ConsentState, required: boolean): string {
  if (state === 'granted') {
    return 'Analytics id: on. This browser keeps a random id and reports which pages lead to training.';
  }
  if (state === 'denied') {
    return 'Analytics id: off. Nothing is stored on this device and pages are counted without an id.';
  }
  return required
    ? 'Analytics id: off until you choose. We have not stored anything on this device.'
    : 'Analytics id: on. This browser keeps a random id; you can turn it off here.';
}

export function mountConsentChoices(container: HTMLElement | null): void {
  if (typeof document === 'undefined' || !container) {
    return;
  }

  const status = document.createElement('p');
  status.className = 'text-base leading-[1.7] text-secondary';
  status.setAttribute('role', 'status');

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap gap-2';

  const turnOff = document.createElement('button');
  turnOff.type = 'button';
  turnOff.className = 'btn-outline text-sm';
  turnOff.textContent = 'Turn off and delete the id';

  const turnOn = document.createElement('button');
  turnOn.type = 'button';
  turnOn.className = 'btn-primary text-sm';
  turnOn.textContent = 'Turn on';

  function render(): void {
    const state = readConsentState();
    const required = isConsentRequired();
    status.textContent = describeState(state, required);
    // Only the action that would change something is offered, so the control
    // never invites a click that does nothing.
    const on = canUseIdentifiedAnalytics({ state });
    turnOff.hidden = !on;
    turnOn.hidden = on;
  }

  function choose(granted: boolean): void {
    setConsentDecision(granted);
    render();
  }

  turnOff.addEventListener('click', () => choose(false));
  turnOn.addEventListener('click', () => choose(true));

  actions.append(turnOff, turnOn);
  container.append(status, actions);
  render();
}
