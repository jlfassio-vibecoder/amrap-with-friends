import { callRpc } from '@/lib/api/callRpc';
import type { TimeDomain } from '@/data/workoutTemplates';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';
import { readMovementVariants, type MovementVariantSelection } from '@/lib/mission/exerciseScaling';
import { readModifiedMovements } from '@/lib/mission/modifiedMovements';
import type { CampaignBenchmarkInput } from '@/lib/benchmark/campaignBenchmarkSlots';

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
  domain_mismatch: 'This clock cannot carry a benchmark.',
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
      durationMinutes: benchmark.durationMinutes,
    }));
}

function authError(error: { message: string }): BenchmarkApiError | null {
  return error.message.includes('Authentication required')
    ? { message: 'Sign in to keep benchmarks.' }
    : null;
}

/**
 * A scored mission of the caller's, in the eight columns an attempt needs.
 *
 * Structurally an `AttemptCandidate`, and deliberately not a `MyMissionEntry`:
 * the card has no use for workouts, breakdowns or chain counts, and shipping
 * them on every HUD load was the expensive half of deriving attempts.
 */
export interface BenchmarkAttemptRow {
  missionId: string;
  templateId: string | null;
  durationMinutes: number;
  createdAt: string;
  scheduledAt: string | null;
  finalScore: number | null;
  modifiedMovements: string[];
  movementVariants: MovementVariantSelection;
}

export interface BenchmarkOverview {
  benchmarks: AthleteBenchmark[];
  /** Live campaigns' raw schedules, for `campaignBenchmarkSlots`. */
  campaigns: CampaignBenchmarkInput[];
  /** Empty unless `includeAttempts` was asked for. */
  attempts: BenchmarkAttemptRow[];
}

function parseAttemptRow(raw: unknown): BenchmarkAttemptRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const missionId = readString(row.mission_id);
  const durationMinutes = typeof row.duration_minutes === 'number' ? row.duration_minutes : null;
  const createdAt = readString(row.created_at);
  if (!missionId || durationMinutes === null || !createdAt) {
    return null;
  }
  return {
    missionId,
    templateId: readString(row.template_id),
    durationMinutes,
    createdAt,
    scheduledAt: readString(row.scheduled_at),
    finalScore: typeof row.final_score === 'number' ? row.final_score : null,
    modifiedMovements: readModifiedMovements(row.modified_movements),
    movementVariants: readMovementVariants(row.movement_variants),
  };
}

function parseCampaignSchedule(raw: unknown): CampaignBenchmarkInput | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const name = readString(row.name);
  const status = readString(row.status);
  if (!name || !status) {
    return null;
  }
  const schedule = Array.isArray(row.schedule) ? row.schedule : [];
  return {
    name,
    status,
    schedule: schedule.map((entry) => {
      const slot = (entry ?? {}) as Record<string, unknown>;
      return {
        weekNumber: typeof slot.week_number === 'number' ? slot.week_number : 0,
        templateId: readString(slot.template_id),
        durationMinutes: typeof slot.duration_minutes === 'number' ? slot.duration_minutes : 0,
      };
    }),
  };
}

/**
 * Everything the Benchmarks card needs, in one round trip.
 *
 * `includeAttempts` is off by default because the rally point does not need
 * them — it only asks whether this workout is already a benchmark and which
 * slots are free — and attempts are the only part of the payload that grows
 * with an athlete's history.
 */
export async function fetchBenchmarkOverview(
  includeAttempts = false
): Promise<{ data: BenchmarkOverview | null; error: BenchmarkApiError | null }> {
  const { data, error } = await callRpc('benchmark_overview', {
    p_include_attempts: includeAttempts,
  });

  if (error) {
    return { data: null, error: authError(error) ?? { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const readList = <T>(value: unknown, parse: (entry: unknown) => T | null): T[] =>
    (Array.isArray(value) ? value : [])
      .map((entry) => parse(entry))
      .filter((entry): entry is T => entry !== null);

  return {
    data: {
      benchmarks: readList(raw.benchmarks, parseAthleteBenchmark),
      campaigns: readList(raw.campaigns, parseCampaignSchedule),
      attempts: readList(raw.attempts, parseAttemptRow),
    },
    error: null,
  };
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
