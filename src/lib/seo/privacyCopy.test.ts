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

  it('does not add a consent banner or name the storage key', () => {
    expect(source).not.toMatch(/consent/i);
    expect(source).not.toContain('amrap_anon_id');
    expect(section).not.toMatch(/\bcookie/i);
  });
});
