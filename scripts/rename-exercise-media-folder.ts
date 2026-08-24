/**
 * One-off: move all objects from one exercise-media prefix to another.
 *
 * Usage:
 *   npx tsx scripts/rename-exercise-media-folder.ts <fromPrefix> <toPrefix>
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

async function listAll(
  supabase: ReturnType<typeof createClient>,
  prefix: string
): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(EXERCISE_MEDIA_BUCKET).list(prefix, {
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
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        out.push(...(await listAll(supabase, path)));
      } else {
        out.push(path);
      }
    }

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return out;
}

async function main(): Promise<void> {
  const fromPrefix = process.argv[2]?.trim();
  const toPrefix = process.argv[3]?.trim();

  if (!fromPrefix || !toPrefix) {
    console.error('Usage: npx tsx scripts/rename-exercise-media-folder.ts <fromPrefix> <toPrefix>');
    process.exit(1);
  }

  loadEnvFile(resolve(ROOT, '.env'));

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing env. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files = await listAll(supabase, fromPrefix);
  console.log(`Found ${files.length} file(s) under ${fromPrefix}/`);

  if (files.length === 0) {
    const { error } = await supabase.storage
      .from(EXERCISE_MEDIA_BUCKET)
      .upload(`${toPrefix}/.keep`, new Uint8Array([0]), {
        upsert: true,
        contentType: 'application/octet-stream',
      });

    if (error) {
      console.error(`Failed to create ${toPrefix}/ — ${error.message}`);
      process.exit(1);
    }

    console.log(`No ${fromPrefix} files; created ${toPrefix}/.keep`);
    return;
  }

  for (const file of files) {
    const dest = file.replace(fromPrefix, toPrefix);
    const { error } = await supabase.storage.from(EXERCISE_MEDIA_BUCKET).move(file, dest);

    if (error) {
      console.error(`Move failed ${file} -> ${dest} — ${error.message}`);
      process.exit(1);
    }

    console.log(`Moved ${file} -> ${dest}`);
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
