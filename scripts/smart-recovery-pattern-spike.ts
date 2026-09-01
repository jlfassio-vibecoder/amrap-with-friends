/**
 * Phase 0 spike — compare category-only vs exercise-enriched template pattern coverage.
 * Run: npx tsx scripts/smart-recovery-pattern-spike.ts
 */
import {
  WORKOUT_TEMPLATES,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '../src/data/workoutTemplates.ts';
import { deriveTemplatePrimaryPatterns } from '../src/lib/smartRecovery/deriveTemplatePatterns.ts';
import {
  CATEGORY_DEFAULT_PATTERNS,
  type MovementPattern,
} from '../src/lib/smartRecovery/movementPatterns.ts';

const TOP_PATTERN_COUNT = 2;

function topPatternsByFrequency(counts: Map<MovementPattern, number>): MovementPattern[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_PATTERN_COUNT)
    .map(([pattern]) => pattern);
}

function capToTop(patterns: MovementPattern[]): MovementPattern[] {
  if (patterns.length <= TOP_PATTERN_COUNT) {
    return patterns;
  }
  const counts = new Map<MovementPattern, number>();
  for (const pattern of patterns) {
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return topPatternsByFrequency(counts);
}

function deriveCategoryOnlyPatterns(template: WorkoutTemplate): MovementPattern[] {
  const category = template.category;
  if (!category) {
    return [];
  }
  return capToTop(CATEGORY_DEFAULT_PATTERNS[category]);
}

function formatPatterns(patterns: MovementPattern[]): string {
  return patterns.length > 0 ? patterns.join(', ') : '(empty)';
}

function coverageReport(
  templates: WorkoutTemplate[],
  derive: (template: WorkoutTemplate) => MovementPattern[]
): { covered: number; empty: WorkoutTemplate[] } {
  const empty: WorkoutTemplate[] = [];
  let covered = 0;
  for (const template of templates) {
    const patterns = derive(template);
    if (patterns.length > 0) {
      covered += 1;
    } else {
      empty.push(template);
    }
  }
  return { covered, empty };
}

function main(): void {
  const templates = WORKOUT_TEMPLATES;
  const categoryOnly = coverageReport(templates, deriveCategoryOnlyPatterns);
  const enriched = coverageReport(templates, deriveTemplatePrimaryPatterns);

  const mismatches: Array<{
    id: string;
    name: string;
    category: WorkoutCategory | null;
    categoryOnly: MovementPattern[];
    enriched: MovementPattern[];
  }> = [];

  for (const template of templates) {
    const categoryPatterns = deriveCategoryOnlyPatterns(template);
    const enrichedPatterns = deriveTemplatePrimaryPatterns(template);
    const topCategory = categoryPatterns[0] ?? null;
    const topEnriched = enrichedPatterns[0] ?? null;
    if (topCategory !== topEnriched) {
      mismatches.push({
        id: template.id,
        name: template.name,
        category: template.category,
        categoryOnly: categoryPatterns,
        enriched: enrichedPatterns,
      });
    }
  }

  const byCategory = new Map<
    WorkoutCategory | null,
    { total: number; mismatches: number; enrichedEmpty: number }
  >();

  for (const template of templates) {
    const key = template.category;
    const row = byCategory.get(key) ?? { total: 0, mismatches: 0, enrichedEmpty: 0 };
    row.total += 1;
    const categoryPatterns = deriveCategoryOnlyPatterns(template);
    const enrichedPatterns = deriveTemplatePrimaryPatterns(template);
    if ((categoryPatterns[0] ?? null) !== (enrichedPatterns[0] ?? null)) {
      row.mismatches += 1;
    }
    if (enrichedPatterns.length === 0) {
      row.enrichedEmpty += 1;
    }
    byCategory.set(key, row);
  }

  const enrichedPct = ((enriched.covered / templates.length) * 100).toFixed(1);
  const categoryPct = ((categoryOnly.covered / templates.length) * 100).toFixed(1);

  console.log('# Smart Recovery — pattern spike\n');
  console.log(`Templates analyzed: **${templates.length}**\n`);

  console.log('## Coverage summary\n');
  console.log('| Path | Templates with ≥1 pattern | Coverage |');
  console.log('| --- | --- | --- |');
  console.log(
    `| Category-only | ${categoryOnly.covered} / ${templates.length} | ${categoryPct}% |`
  );
  console.log(
    `| Exercise-enriched | ${enriched.covered} / ${templates.length} | ${enrichedPct}% |`
  );
  console.log('');

  console.log('## Top-pattern mismatches (category-only vs enriched)\n');
  console.log(`Count: **${mismatches.length}** / ${templates.length}\n`);

  console.log('## Per-category breakdown\n');
  console.log('| Category | Templates | Top-pattern mismatches | Enriched empty |');
  console.log('| --- | --- | --- | --- |');
  for (const [category, row] of [...byCategory.entries()].sort((a, b) =>
    String(a[0]).localeCompare(String(b[0]))
  )) {
    console.log(
      `| ${category ?? '(none)'} | ${row.total} | ${row.mismatches} | ${row.enrichedEmpty} |`
    );
  }
  console.log('');

  if (enriched.empty.length > 0) {
    console.log('## Exercise-enriched empty templates\n');
    for (const template of enriched.empty) {
      console.log(
        `- \`${template.id}\` — ${template.name} (${template.category ?? 'no category'})`
      );
    }
    console.log('');
  }

  console.log('## Sample mismatches (first 15)\n');
  console.log('| Template | Category | Category-only | Enriched |');
  console.log('| --- | --- | --- | --- |');
  for (const row of mismatches.slice(0, 15)) {
    console.log(
      `| ${row.name} (\`${row.id}\`) | ${row.category ?? '(none)'} | ${formatPatterns(row.categoryOnly)} | ${formatPatterns(row.enriched)} |`
    );
  }
  console.log('');

  const passThreshold = enriched.covered / templates.length >= 0.9;
  console.log(
    `## Exit criterion (exercise-enriched ≥90%): **${passThreshold ? 'PASS' : 'FAIL'}** (${enrichedPct}%)`
  );
}

main();
