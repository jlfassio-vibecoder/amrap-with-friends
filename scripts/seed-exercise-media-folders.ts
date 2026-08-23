/**
 * Manual one-off: seed empty `${exerciseId}/.keep` placeholders in the
 * public `exercise-media` Storage bucket so folders appear in the dashboard
 * before real media is uploaded.
 *
 * Usage (from repo root, with .env loaded):
 *   npm run seed:exercise-media
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (never VITE_*) and VITE_SUPABASE_URL
 * (or SUPABASE_URL). Safe to re-run — uploads use upsert: true.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { EXERCISE_LIBRARY } from '../src/data/exerciseLibrary.ts';

const EXERCISE_MEDIA_BUCKET = 'exercise-media';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

const placeholder = new Uint8Array([0]);
let ok = 0;
let failed = 0;

console.log(
  `Seeding ${EXERCISE_LIBRARY.length} exercise-media folders (.keep placeholders)…\n`
);

for (const exercise of EXERCISE_LIBRARY) {
  const path = `${exercise.id}/.keep`;
  const { error } = await supabase.storage
    .from(EXERCISE_MEDIA_BUCKET)
    .upload(path, placeholder, {
      upsert: true,
      contentType: 'application/octet-stream',
    });

  if (error) {
    failed += 1;
    console.error(`  ✗ ${exercise.id} — ${error.message}`);
  } else {
    ok += 1;
    console.log(`  ✓ ${exercise.id}`);
  }
}

console.log(`\nDone. ${ok} ok, ${failed} failed (of ${EXERCISE_LIBRARY.length}).`);
process.exit(failed > 0 ? 1 : 0);
