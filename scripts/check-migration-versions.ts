/**
 * The duplicate-version check as a standalone command, so it can run in a git
 * hook without paying for vitest startup on every commit.
 *
 * Shares its logic with src/lib/migrations/migrationVersions.ts — the test
 * covers the same functions, so the hook and CI can never disagree about what
 * counts as a collision.
 */
import { readdirSync } from 'node:fs';
import {
  findDuplicateVersions,
  findMalformedNames,
  nextFreeVersion,
} from '../src/lib/migrations/migrationVersions';

const names = readdirSync('supabase/migrations');
const duplicates = findDuplicateVersions(names);
const malformed = findMalformedNames(names);

if (duplicates.length === 0 && malformed.length === 0) {
  process.exit(0);
}

for (const entry of duplicates) {
  console.error(
    `Two migrations claim version ${entry.version}:\n` +
      entry.files.map((file) => `  ${file}`).join('\n') +
      `\nOnly one can ever be recorded in schema_migrations — the other is` +
      ` shadowed and its SQL never runs.\nRename the newer one to ${nextFreeVersion(names)}.\n`
  );
}

for (const name of malformed) {
  console.error(`Not <timestamp>_<snake_case>.sql, so it sorts unpredictably: ${name}`);
}

process.exit(1);
