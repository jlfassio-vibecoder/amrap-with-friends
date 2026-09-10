import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findDuplicateVersions,
  findMalformedNames,
  nextFreeVersion,
  parseMigrationName,
} from '@/lib/migrations/migrationVersions';

const MIGRATIONS_DIR = 'supabase/migrations';

describe('the migrations directory', () => {
  const names = readdirSync(MIGRATIONS_DIR);

  it('has no two migrations claiming one version', () => {
    // schema_migrations is keyed by the timestamp prefix, so only one of a
    // colliding pair can ever be recorded. The other is shadowed for good:
    // db push reports success, the SQL never runs, and the symptom is a
    // feature that quietly does not work in production. Rename the newer file
    // to the version this test suggests.
    const duplicates = findDuplicateVersions(names);
    const detail = duplicates.map(
      (entry) =>
        `${entry.version}: ${entry.files.join(' and ')} — rename one to ${nextFreeVersion(names)}`
    );
    expect(detail).toEqual([]);
  });

  it('names every migration <timestamp>_<snake_case>.sql', () => {
    // A malformed name sorts unpredictably against the rest, which decides
    // apply order.
    expect(findMalformedNames(names)).toEqual([]);
  });

  it('actually found migrations to check', () => {
    // Guards the guard: a wrong path here would make both tests above pass
    // over an empty list forever.
    expect(names.filter((name) => name.endsWith('.sql')).length).toBeGreaterThan(50);
  });
});

describe('parseMigrationName', () => {
  it('accepts the repo convention', () => {
    expect(parseMigrationName('20260909560000_mission_shares_and_replay.sql')).toEqual({
      name: '20260909560000_mission_shares_and_replay.sql',
      version: '20260909560000',
    });
  });

  it('rejects names that are not migrations', () => {
    expect(parseMigrationName('README.md')).toBeNull();
    expect(parseMigrationName('2026_short.sql')).toBeNull();
    expect(parseMigrationName('20260909560000-kebab-case.sql')).toBeNull();
    expect(parseMigrationName('20260909560000_Mixed_Case.sql')).toBeNull();
  });
});

describe('findDuplicateVersions', () => {
  it('reports both files, so the message names what to rename', () => {
    expect(
      findDuplicateVersions([
        '20260909460000_tool_conversion.sql',
        '20260909460000_hud_domain_active_recovery.sql',
        '20260909470000_other.sql',
      ])
    ).toEqual([
      {
        version: '20260909460000',
        files: [
          '20260909460000_hud_domain_active_recovery.sql',
          '20260909460000_tool_conversion.sql',
        ],
      },
    ]);
  });

  it('finds every collision, not just the first', () => {
    const duplicates = findDuplicateVersions([
      '20260101000000_a.sql',
      '20260101000000_b.sql',
      '20260102000000_c.sql',
      '20260102000000_d.sql',
    ]);
    expect(duplicates.map((entry) => entry.version)).toEqual(['20260101000000', '20260102000000']);
  });

  it('is quiet when every version is unique', () => {
    expect(findDuplicateVersions(['20260101000000_a.sql', '20260101000100_b.sql'])).toEqual([]);
  });

  it('ignores files that are not migrations', () => {
    expect(findDuplicateVersions(['README.md', 'notes.txt'])).toEqual([]);
  });
});

describe('findMalformedNames', () => {
  it('flags only .sql files that break the convention', () => {
    expect(
      findMalformedNames(['20260101000000_ok.sql', 'oops.sql', 'README.md', '.gitignore'])
    ).toEqual(['oops.sql']);
  });
});

describe('nextFreeVersion', () => {
  it('follows the repo counter, which is not a real clock', () => {
    // The newest versions carry "54"/"55"/"56" in the hour field: a
    // hand-maintained counter in timestamp shape, not a calendar time.
    expect(nextFreeVersion(['20260909540000_a.sql', '20260909550000_b.sql'])).toBe(
      '20260909560000'
    );
  });

  it('steps past the highest, not the last listed', () => {
    expect(nextFreeVersion(['20260909550000_b.sql', '20260909540000_a.sql'])).toBe(
      '20260909560000'
    );
  });

  it('has an answer for an empty directory', () => {
    expect(nextFreeVersion([])).toBe('20260101000000');
  });
});
