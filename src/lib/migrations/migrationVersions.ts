/**
 * Guards against the way Supabase migrations actually break in a repo with
 * several branches in flight.
 *
 * `supabase_migrations.schema_migrations` is keyed by the timestamp prefix, so
 * two files sharing one prefix can never both be recorded. The second is
 * shadowed for good: `db push` reports success, the SQL never runs, and the
 * only symptom is a feature that quietly does not work in production. It has
 * happened three times here, always because two branches picked the same
 * timestamp independently.
 *
 * Cheap to detect, expensive to find afterwards — which is the whole argument
 * for checking it in CI.
 */

export interface MigrationFile {
  name: string;
  version: string;
}

const MIGRATION_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export function parseMigrationName(name: string): MigrationFile | null {
  const match = MIGRATION_NAME.exec(name);
  return match ? { name, version: match[1] as string } : null;
}

/** Files that are not `<14-digit timestamp>_<snake_case>.sql`. They sort unpredictably against the ones that are. */
export function findMalformedNames(names: string[]): string[] {
  return names.filter((name) => name.endsWith('.sql') && !MIGRATION_NAME.test(name));
}

/** Versions claimed by more than one file, with the files that claim them. */
export function findDuplicateVersions(names: string[]): { version: string; files: string[] }[] {
  const byVersion = new Map<string, string[]>();
  for (const name of names) {
    const parsed = parseMigrationName(name);
    if (!parsed) {
      continue;
    }
    byVersion.set(parsed.version, [...(byVersion.get(parsed.version) ?? []), name]);
  }
  return [...byVersion.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files: [...files].sort() }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * A free version above everything present — what a colliding file should be
 * renamed to.
 *
 * Steps by 10000 because this repo's versions are not real clock times: the
 * newest are 20260909540000, 550000, 560000, where "56" sits in the hour
 * field. They are a hand-maintained counter in timestamp shape, so the next
 * one follows that counter rather than a calendar.
 */
export function nextFreeVersion(names: string[]): string {
  const versions = names
    .map((name) => parseMigrationName(name)?.version)
    .filter((version): version is string => Boolean(version))
    .sort();
  const highest = versions[versions.length - 1];
  return highest ? String(Number(highest) + 10000) : '20260101000000';
}
