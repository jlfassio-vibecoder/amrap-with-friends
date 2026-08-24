/**
 * Compare workout-template movements + exercise library against the
 * `exercise-media` Storage bucket, then seed `.keep` placeholders for any
 * missing exercise folders.
 *
 * Usage (from repo root, with .env loaded):
 *   npx tsx scripts/sync-exercise-media-folders.ts
 *   npx tsx scripts/sync-exercise-media-folders.ts --dry-run
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (never VITE_*) and VITE_SUPABASE_URL
 * (or SUPABASE_URL).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { EXERCISE_LIBRARY, getExerciseInfo } from '../src/data/exerciseLibrary.ts';
import { WORKOUT_TEMPLATES } from '../src/data/workoutTemplates.ts';

const EXERCISE_MEDIA_BUCKET = 'exercise-media';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function slugifyMovementName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function listTopLevelFolders(
  supabase: ReturnType<typeof createClient>
): Promise<string[]> {
  const names: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(EXERCISE_MEDIA_BUCKET).list('', {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    for (const item of data) {
      names.push(item.name);
    }

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return names.sort();
}

function collectExpectedFolderIds(): {
  expectedIds: string[];
  missingFromLibrary: string[];
} {
  const expected = new Set<string>(EXERCISE_LIBRARY.map((entry) => entry.id));
  const missingFromLibrary: string[] = [];
  const seenNames = new Set<string>();

  for (const template of WORKOUT_TEMPLATES) {
    for (const movement of template.movements) {
      if (seenNames.has(movement.name)) {
        continue;
      }
      seenNames.add(movement.name);

      const info = getExerciseInfo(movement.name);
      if (info) {
        expected.add(info.id);
        continue;
      }

      missingFromLibrary.push(movement.name);
      expected.add(slugifyMovementName(movement.name));
    }
  }

  return {
    expectedIds: [...expected].sort(),
    missingFromLibrary: missingFromLibrary.sort(),
  };
}

async function main(): Promise<void> {
  loadEnvFile(resolve(ROOT, '.env'));

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing env. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
        'Do not use VITE_ for the service role key — it must never ship to the browser.'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { expectedIds, missingFromLibrary } = collectExpectedFolderIds();
  const bucketFolders = await listTopLevelFolders(supabase);
  const bucketSet = new Set(bucketFolders);
  const missingFolders = expectedIds.filter((id) => !bucketSet.has(id));
  const bucketOnly = bucketFolders.filter(
    (name) =>
      name !== '.emptyFolderPlaceholder' &&
      name !== '.keep' &&
      !expectedIds.includes(name)
  );

  console.log(`Library entries: ${EXERCISE_LIBRARY.length}`);
  console.log(`Expected folders (library + template movements): ${expectedIds.length}`);
  console.log(`Bucket top-level entries: ${bucketFolders.length}`);
  console.log(`Template movements without library entry: ${missingFromLibrary.length}`);
  console.log(`Missing folders to seed: ${missingFolders.length}`);

  if (missingFromLibrary.length > 0) {
    console.log('\nMovements not in exercise library (folders will still be seeded):');
    for (const name of missingFromLibrary) {
      console.log(`  - ${name} → ${slugifyMovementName(name)}`);
    }
  }

  if (bucketOnly.length > 0) {
    console.log('\nBucket folders with no matching app exercise (left untouched):');
    for (const name of bucketOnly) {
      console.log(`  - ${name}`);
    }
  }

  if (missingFolders.length === 0) {
    console.log('\nBucket is already complete. Nothing to seed.');
    return;
  }

  console.log(`\n${dryRun ? '[dry-run] Would seed' : 'Seeding'} ${missingFolders.length} missing folder(s):\n`);

  if (dryRun) {
    for (const id of missingFolders) {
      console.log(`  · ${id}`);
    }
    return;
  }

  const placeholder = new Uint8Array([0]);
  let ok = 0;
  let failed = 0;

  for (const id of missingFolders) {
    const path = `${id}/.keep`;
    const { error } = await supabase.storage.from(EXERCISE_MEDIA_BUCKET).upload(path, placeholder, {
      upsert: true,
      contentType: 'application/octet-stream',
    });

    if (error) {
      failed += 1;
      console.error(`  ✗ ${id} — ${error.message}`);
    } else {
      ok += 1;
      console.log(`  ✓ ${id}`);
    }
  }

  console.log(`\nDone. ${ok} seeded, ${failed} failed (of ${missingFolders.length}).`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
