import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VAULT_SAMPLE_URLS } from '@/lib/audio/vaultSamples';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * The vault samples must be reachable at the URLs the player asks for.
 *
 * `publicDir: false` is required for a production build — Astro owns public/
 * and merge-build assembles the two outputs — but applying it to the dev server
 * too made every file under public/ resolve to the SPA shell. `fetch` then
 * succeeded with HTML, `decodeAudioData` threw, and the cue fell back to
 * synthesis: the sounds were dead locally and fine in production, for months,
 * with nothing in the application code to find.
 *
 * These assert the two halves that have to stay true together.
 */
describe('vault samples are reachable where the player looks for them', () => {
  it('exists on disk at each URL the player requests', () => {
    for (const url of Object.values(VAULT_SAMPLE_URLS)) {
      const file = join(root, 'public', url.replace(/^\//, ''));
      expect(existsSync(file), `${url} is missing from public/`).toBe(true);
    }
  });

  it('is served by the dev server, and still not duplicated into the build', () => {
    const config = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    // Serve in dev, off for build. Either half alone reintroduces a bug:
    // always-off kills the sounds locally, always-on duplicates public/ into
    // dist-app and lets the SPA build shadow Astro's copy.
    expect(config).toMatch(/publicDir:\s*command === 'serve' \? 'public' : false/);
  });
});
