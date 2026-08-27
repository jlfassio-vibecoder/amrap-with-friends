import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissWalkthroughForever,
  isWalkthroughDismissed,
  resetWalkthroughPrefs,
  walkthroughStorageKey,
} from './walkthroughPrefs';

afterEach(() => {
  resetWalkthroughPrefs();
});

describe('walkthroughPrefs', () => {
  it('starts undismissed for each role', () => {
    expect(isWalkthroughDismissed('host')).toBe(false);
    expect(isWalkthroughDismissed('joiner')).toBe(false);
  });

  it('persists forever-dismiss per role', () => {
    dismissWalkthroughForever('host');

    expect(isWalkthroughDismissed('host')).toBe(true);
    expect(isWalkthroughDismissed('joiner')).toBe(false);
    expect(walkthroughStorageKey('host')).toBe('amrap_staging_walkthrough_v1_host');
  });

  it('does not treat joiner dismiss as host dismiss', () => {
    dismissWalkthroughForever('joiner');

    expect(isWalkthroughDismissed('joiner')).toBe(true);
    expect(isWalkthroughDismissed('host')).toBe(false);
  });
});
