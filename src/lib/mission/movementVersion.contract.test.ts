import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareCodePoints, versionKeyFor } from '@/lib/mission/movementVersion';
import { EXERCISE_SCALING } from '@/data/exerciseScaling';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260909170000_same_variant_ghost.sql'),
  'utf8'
);

/**
 * The version key exists twice: in TypeScript, where the client composes the key
 * for the version the athlete is about to perform, and in SQL, where
 * `available_ghosts` computes the same key for every stored result to find a
 * match.
 *
 * A disagreement between them does not raise. The keys simply never match, the
 * ghost is silently absent, and the only symptom is a feature that appears not
 * to work. So rather than trusting that the two read alike, this rebuilds the
 * SQL semantics from the migration's own text and runs both over every input the
 * product can produce.
 */
function parseSqlVersionKey(): (modified: string[], variants: Record<string, string>) => string {
  const match = /CREATE OR REPLACE FUNCTION public\.movement_version_key[\s\S]*?\$function\$;/.exec(
    migration
  );
  expect(match, 'movement_version_key is missing from the migration').not.toBeNull();
  const sql = match![0];

  // The four decisions the SQL body makes, each read back out of it rather than
  // assumed: the separator, the name/option joiner, the ordering, and the fact
  // that both sources of names are unioned and de-duplicated.
  const aggregate =
    /string_agg\(\s*name \|\| '(.+?)' \|\| coalesce\(p_movement_variants ->> name, ''\),\s*'(.+?)' ORDER BY name COLLATE "(\w+)"/.exec(
      sql
    );
  expect(aggregate, 'could not read the key construction out of the SQL').not.toBeNull();

  const joiner = aggregate![1];
  const separator = aggregate![2];
  const collation = aggregate![3];

  // COLLATE "C" is byte order on UTF-8, which is code-point order. Any other
  // collation would make the key depend on the database's locale.
  expect(collation).toBe('C');
  expect(sql).toContain('SELECT DISTINCT name');
  expect(sql).toContain('unnest(coalesce(p_modified_movements, ARRAY[]::text[]))');
  expect(sql).toContain("jsonb_object_keys(coalesce(p_movement_variants, '{}'::jsonb))");
  // string_agg over no rows is NULL; the empty string is what "as programmed" means.
  expect(sql).toMatch(/coalesce\(\s*string_agg/);

  return (modified, variants) => {
    const names = [...new Set([...modified, ...Object.keys(variants)])];
    if (names.length === 0) {
      return '';
    }
    return names
      .sort(compareCodePoints)
      .map((name) => `${name}${joiner}${variants[name] ?? ''}`)
      .join(separator);
  };
}

const sqlVersionKey = parseSqlVersionKey();

function bothAgree(modified: string[], variants: Record<string, string>) {
  const ts = versionKeyFor({ modifiedMovements: modified, movementVariants: variants });
  expect(ts).toBe(sqlVersionKey(modified, variants));
  return ts;
}

describe('movement_version_key: SQL and TypeScript agree', () => {
  it('on a mission performed as programmed', () => {
    expect(bothAgree([], {})).toBe('');
  });

  it('on every option in the scaling library, one movement at a time', () => {
    for (const ladder of EXERCISE_SCALING) {
      for (const option of ladder.options) {
        const name = `Movement ${ladder.exerciseId}`;
        bothAgree([name], { [name]: option.id });
      }
    }
  });

  it('on a movement marked without a named scaling', () => {
    expect(bothAgree(['Diamond Push-ups'], {})).toBe('Diamond Push-ups#');
  });

  it('on a variant named for a movement not in the modified list', () => {
    // The union matters: either source alone must contribute the name.
    expect(bothAgree([], { 'Diamond Push-ups': 'push-up--knees' })).toBe(
      'Diamond Push-ups#push-up--knees'
    );
  });

  it('on several movements, in whichever order they were marked', () => {
    const forward = bothAgree(['Air Squats', 'Diamond Push-ups'], {
      'Air Squats': 'squat--box',
      'Diamond Push-ups': 'push-up--knees',
    });
    const reverse = bothAgree(['Diamond Push-ups', 'Air Squats'], {
      'Diamond Push-ups': 'push-up--knees',
      'Air Squats': 'squat--box',
    });
    expect(forward).toBe(reverse);
  });

  it('on a name repeated in both sources', () => {
    bothAgree(['Diamond Push-ups', 'Diamond Push-ups'], {
      'Diamond Push-ups': 'push-up--knees',
    });
  });

  it('on names whose ordering a locale collation would get wrong', () => {
    // en_US.UTF-8 ignores case and punctuation when ordering; C does not.
    // If either side ever fell back to the database collation, these flip.
    bothAgree(['diamond push-ups', 'Diamond Push-ups', 'Air Squats'], {});
    bothAgree(['Push-ups', 'Push ups', 'Pushups'], {});
    bothAgree(['a', 'B', 'C', 'b'], {});
  });

  it('on a name carrying an astral character', () => {
    // Sorted by UTF-16 code unit, the emoji would come before "Ａ"; by code
    // point (and by UTF-8 bytes, which is what COLLATE "C" compares) it comes
    // after. This is the case that makes compareCodePoints necessary.
    bothAgree(['\u{1F4AA} Push-ups', 'Ａ Squats'], {});
  });

  it('on names containing the separator and joiner characters themselves', () => {
    bothAgree(['A|B', 'A#B'], { 'A|B': 'push-up--knees' });
  });
});

describe('compareCodePoints', () => {
  it('orders by code point, not by UTF-16 code unit', () => {
    const astral = '\u{1F4AA}';
    const bmp = 'Ａ';
    expect(compareCodePoints(astral, bmp)).toBeGreaterThan(0);
    // The default sort disagrees, which is the whole reason this exists.
    expect([astral, bmp].sort()).toEqual([astral, bmp]);
    expect([astral, bmp].sort(compareCodePoints)).toEqual([bmp, astral]);
  });

  it('treats a prefix as smaller than the string extending it', () => {
    expect(compareCodePoints('Push', 'Push-ups')).toBeLessThan(0);
  });

  it('is zero for equal strings', () => {
    expect(compareCodePoints('Diamond Push-ups', 'Diamond Push-ups')).toBe(0);
  });
});
