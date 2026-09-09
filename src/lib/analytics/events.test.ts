import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENT_NAMES, RETIRED_ANALYTICS_EVENT_NAMES } from '@/lib/analytics/events';

const SRC_DIR = 'src';
// The Astro content pages emit through sendContentEvent rather than track(),
// and they live outside src/ -- without this the registry would drift again,
// in exactly the corner nothing else looks at.
const SITE_DIR = 'site';
const MIGRATIONS_DIR = 'supabase/migrations';

function walk(dir: string, matches: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path, matches));
      continue;
    }
    if (matches(path)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Local names `track`/`trackBeacon` were imported under in this file —
 * CreateCampaignPage imports `track as trackEvent`, so matching the export
 * name alone would miss `campaign_created` entirely.
 */
function trackAliases(source: string): string[] {
  const aliases: string[] = [];
  for (const match of source.matchAll(
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'@\/lib\/analytics\/(?:track|contentBeacon)'/g
  )) {
    for (const clause of match[1].split(',')) {
      const parts = clause.trim().split(/\s+as\s+/);
      const imported = parts[0]?.trim();
      const local = (parts[1] ?? parts[0])?.trim();
      if (
        local &&
        (imported === 'track' || imported === 'trackBeacon' || imported === 'sendContentEvent')
      ) {
        aliases.push(local);
      }
    }
  }
  return aliases;
}

function emittedEventNames(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const isSource = (path: string) =>
    /\.(tsx?|astro)$/.test(path) &&
    !/\.test\.tsx?$/.test(path) &&
    !path.endsWith('track.ts') &&
    !path.endsWith('contentBeacon.ts');
  const files = [...walk(SRC_DIR, isSource), ...walk(SITE_DIR, isSource)];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const aliases = trackAliases(source);
    if (aliases.length === 0) {
      continue;
    }
    const callSite = new RegExp(`\\b(?:${aliases.join('|')})\\(\\s*'([^']*)'`, 'g');
    for (const match of source.matchAll(callSite)) {
      const sites = found.get(match[1]) ?? [];
      sites.push(path);
      found.set(match[1], sites);
    }
  }
  return found;
}

/** Every event name a migration filters on, whether `= 'x'` or `IN ('x', 'y')`. */
function sqlEventNames(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of walk(MIGRATIONS_DIR, (p) => p.endsWith('.sql'))) {
    const source = readFileSync(path, 'utf8');
    const literals: string[] = [];
    for (const match of source.matchAll(/event_name\s*(?:=|<>|!=)\s*'([^']*)'/g)) {
      literals.push(match[1]);
    }
    for (const match of source.matchAll(/event_name\s+(?:NOT\s+)?IN\s*\(([^)]*)\)/gi)) {
      for (const inner of match[1].matchAll(/'([^']*)'/g)) {
        literals.push(inner[1]);
      }
    }
    for (const name of literals) {
      const sites = found.get(name) ?? [];
      sites.push(path);
      found.set(name, sites);
    }
  }
  return found;
}

describe('analytics event registry', () => {
  it('has no duplicate entries', () => {
    expect([...new Set(ANALYTICS_EVENT_NAMES)]).toHaveLength(ANALYTICS_EVENT_NAMES.length);
  });

  it('does not list a retired name as current', () => {
    const current = new Set<string>(ANALYTICS_EVENT_NAMES);
    const overlap = RETIRED_ANALYTICS_EVENT_NAMES.filter((name) => current.has(name));
    expect(overlap).toEqual([]);
  });

  it('covers every event name the app emits', () => {
    const known = new Set<string>(ANALYTICS_EVENT_NAMES);
    const unregistered = [...emittedEventNames().entries()]
      .filter(([name]) => !known.has(name))
      .map(([name, paths]) => `${name} (${paths.join(', ')})`);
    expect(unregistered).toEqual([]);
  });

  it('lists no event the app has stopped emitting', () => {
    const emitted = new Set(emittedEventNames().keys());
    const dead = ANALYTICS_EVENT_NAMES.filter((name) => !emitted.has(name));
    expect(dead).toEqual([]);
  });

  it('covers every event name the migrations filter on', () => {
    const known = new Set<string>([...ANALYTICS_EVENT_NAMES, ...RETIRED_ANALYTICS_EVENT_NAMES]);
    const unregistered = [...sqlEventNames().entries()]
      .filter(([name]) => !known.has(name))
      .map(([name, paths]) => `${name} (${[...new Set(paths)].join(', ')})`);
    expect(unregistered).toEqual([]);
  });

  it('matches the current name alongside any retired one it replaced', () => {
    // A view that reads only the retired name reports zero; one that reads only
    // the current name silently drops every pre-rename row. Both must appear.
    const replacements: Record<string, string> = {
      session_created: 'mission_created',
      session_joined: 'mission_joined',
      session_abandoned: 'mission_abandoned',
    };
    const latestViews = join(
      MIGRATIONS_DIR,
      '20260909310000_reporting_views_mission_event_names.sql'
    );
    const source = readFileSync(latestViews, 'utf8');
    for (const [retired, current] of Object.entries(replacements)) {
      if (source.includes(`'${retired}'`)) {
        expect(source).toContain(`'${current}'`);
      }
    }
  });
});
