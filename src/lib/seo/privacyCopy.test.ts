import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function browserIdSection(source: string): string {
  const heading = source.indexOf('Your browser id');
  const nextHeading = source.indexOf('Who else sees it', heading);
  expect(heading).toBeGreaterThan(-1);
  expect(nextHeading).toBeGreaterThan(heading);
  return source.slice(heading, nextHeading);
}

describe('privacy copy contract', () => {
  const source = readFileSync(join(root, 'site/pages/privacy.astro'), 'utf8');
  const section = browserIdSection(source);

  it('discloses the browser id in a dedicated section', () => {
    expect(source).toContain('Your browser id');
    expect(section.toLowerCase()).toContain('not required to train');
    expect(section).toContain('write-only');
    expect(section).toMatch(/does not show you a log/i);
    expect(section).toMatch(/create an account or sign in/i);
    expect(section).toMatch(/associate the id/i);
    expect(section).toMatch(/Clearing this site's data/i);
    expect(section).toMatch(/removes the id/i);
  });

  it('uses mission, not session, as the workout word in the new section', () => {
    expect(section).toMatch(/\bmission\b/);
    expect(section).not.toMatch(/\bsession\b/i);
  });

  it('does not name the internal storage key, or call localStorage a cookie', () => {
    // This used to also assert that no consent flow existed. That was the
    // product decision at the time; it was reversed once the browser id
    // reached the public content pages and ePrivacy Article 5(3) applied.
    // The rest of the intent survives: user-facing copy should not leak an
    // implementation key, and calling localStorage a cookie is simply wrong.
    expect(source).not.toContain('amrap_anon_id');
    expect(section).not.toMatch(/\bcookie/i);
  });

  it('offers a way to withdraw, and says what withdrawing does', () => {
    const heading = source.indexOf('Your privacy choices');
    expect(heading).toBeGreaterThan(-1);
    const choices = source.slice(heading, source.indexOf('Who else sees it', heading));
    expect(choices).toContain('id="privacy-choices"');
    expect(choices).toMatch(/turn the browser id off/i);
    expect(choices).toMatch(/deletes the id/i);
    // Withdrawal is forward-looking and the page must not imply otherwise.
    expect(choices).toMatch(/already received are not undone/i);
  });
});
