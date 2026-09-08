import { callRpc } from '@/lib/api/callRpc';
import type { TimeDomain } from '@/data/workoutTemplates';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';
import {
  readMovementVariants,
  type MovementVariantSelection,
} from '@/lib/mission/exerciseScaling';

export interface AthleteBenchmark {
  id: string;
  templateId: string;
  durationMinutes: number;
  timeDomain: TimeDomain;
  /** '' means the benchmark is the workout as programmed. */
  versionKey: string;
  /**
   * The modification itself, kept so a retest can pre-select it.
   *
   * `versionKey` stays the thing attempts are matched on — this is only ever
   * read to seed a retest, because the key is a one-way fingerprint and cannot
   * be turned back into a selection.
   */
  movementVariants: MovementVariantSelection;
  designatedAt: string;
  /** Non-null once retired: keeps its history, stops holding a slot. */
  retiredAt: string | null;
}

export type BenchmarkApiError = { message: string };

/** Every refusal the RPC can return, mapped to something an athlete can act on. */
const REFUSAL_MESSAGES: Record<string, string> = {
  invalid_template: 'This mission has no workout to measure against.',
  coach_workout: 'Coach workouts cannot be benchmarks yet — a coach can change one underneath you.',
  invalid_domain: 'This clock cannot carry a benchmark.',
  invalid_duration: 'This clock cannot carry a benchmark.',
  at_limit: 'You already have three benchmarks running. Retire one first.',
  domain_taken: 'You already have a benchmark at this length. Retire it first.',
  not_found: 'That benchmark is already retired.',
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readDomain(value: unknown): TimeDomain | null {
  return value === 5 || value === 10 || value === 15 || value === 20 ? value : null;
}

export function parseAthleteBenchmark(raw: unknown): AthleteBenchmark | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = readString(row.id);
  const templateId = readString(row.template_id);
  const timeDomain = readDomain(row.time_domain);
  const designatedAt = readString(row.designated_at);
  const durationMinutes = typeof row.duration_minutes === 'number' ? row.duration_minutes : null;

  if (!id || !templateId || timeDomain === null || durationMinutes === null || !designatedAt) {
    return null;
  }

  return {
    id,
    templateId,
    durationMinutes,
    timeDomain,
    versionKey: typeof row.version_key === 'string' ? row.version_key : '',
    movementVariants: readMovementVariants(row.movement_variants),
    designatedAt,
    retiredAt: readString(row.retired_at),
  };
}

/** The slots an athlete's own designations hold; retired ones hold nothing. */
export function personalBenchmarkSlots(benchmarks: readonly AthleteBenchmark[]): BenchmarkSlot[] {
  return benchmarks
    .filter((benchmark) => benchmark.retiredAt === null)
    .map((benchmark) => ({
      domain: benchmark.timeDomain,
      source: 'personal' as const,
      templateId: benchmark.templateId,
    }));
}

function authError(error: { message: string }): BenchmarkApiError | null {
  return error.message.includes('Authentication required')
    ? { message: 'Sign in to keep benchmarks.' }
    : null;
}

export async function fetchMyBenchmarks(): Promise<{
  data: AthleteBenchmark[] | null;
  error: BenchmarkApiError | null;
}> {
  const { data, error } = await callRpc('my_benchmarks', {});

  if (error) {
    return { data: null, error: authError(error) ?? { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const rows = Array.isArray(raw.benchmarks) ? raw.benchmarks : [];
  return {
    data: rows
      .map((row) => parseAthleteBenchmark(row))
      .filter((row): row is AthleteBenchmark => row !== null),
    error: null,
  };
}

export async function designateBenchmark(input: {
  templateId: string;
  durationMinutes: number;
  timeDomain: TimeDomain;
  versionKey?: string;
  movementVariants?: MovementVariantSelection;
}): Promise<{ data: AthleteBenchmark | null; error: BenchmarkApiError | null }> {
  const { data, error } = await callRpc('designate_benchmark', {
    p_template_id: input.templateId,
    p_duration_minutes: input.durationMinutes,
    p_time_domain: input.timeDomain,
    p_version_key: input.versionKey ?? '',
    p_movement_variants: input.movementVariants ?? {},
  });

  if (error) {
    return { data: null, error: authError(error) ?? { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    const reason = typeof raw.reason === 'string' ? raw.reason : '';
    return {
      data: null,
      error: { message: REFUSAL_MESSAGES[reason] ?? 'Something went wrong. Please try again.' },
    };
  }

  const benchmark = parseAthleteBenchmark(raw.benchmark);
  if (!benchmark) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  return { data: benchmark, error: null };
}

export async function retireBenchmark(
  benchmarkId: string
): Promise<{ ok: boolean; error: BenchmarkApiError | null }> {
  const { data, error } = await callRpc('retire_benchmark', { p_benchmark_id: benchmarkId });

  if (error) {
    return { ok: false, error: authError(error) ?? { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    const reason = typeof raw.reason === 'string' ? raw.reason : '';
    return {
      ok: false,
      error: { message: REFUSAL_MESSAGES[reason] ?? 'Something went wrong. Please try again.' },
    };
  }
  return { ok: true, error: null };
}
