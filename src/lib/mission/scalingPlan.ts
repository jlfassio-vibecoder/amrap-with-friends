import {
  normalizeMovementVariants,
  readMovementVariants,
  type MovementVariantSelection,
} from '@/lib/mission/exerciseScaling';

/**
 * A scaling an athlete chose *before* the mission, held until the result is
 * submitted.
 *
 * This is a draft, not a second answer. The one place a scaling is ever
 * recorded is the result row the end-of-mission checklist writes — the picker
 * seeds that checklist, and the checklist is still what the athlete confirms.
 * Two stores that both claim to say how a mission was performed is the failure
 * mode this avoids: the athlete would change their mind mid-workout and the
 * board would show the plan instead of what they did.
 *
 * Per participant as well as per mission, because two people can share a device
 * (one phone propped against a wall is exactly how a squad of two runs this),
 * and their scalings are their own.
 */

const KEY_PREFIX = 'amrapScalingPlan';

/** Plans kept before the oldest are dropped, so a long-lived device does not grow forever. */
export const MAX_STORED_PLANS = 20;

interface StoredPlan {
  /** Epoch millis, used only to decide which plan to evict. */
  at: number;
  variants: MovementVariantSelection;
}

const memoryFallback = new Map<string, string>();

export function scalingPlanStorageKey(missionId: string, participantId: string): string {
  return `${KEY_PREFIX}:${missionId}:${participantId}`;
}

function readRaw(key: string): string | null {
  try {
    const stored = window.localStorage?.getItem(key);
    if (typeof stored === 'string') {
      return stored;
    }
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
  return memoryFallback.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memoryFallback.set(key, value);
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

function removeRaw(key: string): void {
  memoryFallback.delete(key);
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

function parsePlan(raw: string | null): StoredPlan | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as { at?: unknown; variants?: unknown };
    return {
      at: typeof record.at === 'number' ? record.at : 0,
      variants: readMovementVariants(record.variants),
    };
  } catch {
    return null;
  }
}

/**
 * The plan for this mission, filtered to scalings the workout actually offers.
 *
 * Normalising on read rather than trusting the store means a workout edited
 * after the athlete planned cannot show them a scaling for a movement that is
 * no longer programmed.
 */
export function readScalingPlan(
  missionId: string,
  participantId: string,
  workout: ReadonlyArray<{ name: string }>
): MovementVariantSelection {
  const plan = parsePlan(readRaw(scalingPlanStorageKey(missionId, participantId)));
  if (!plan) {
    return {};
  }
  return normalizeMovementVariants(plan.variants, workout);
}

/** Writing an empty selection clears the plan rather than storing an empty one. */
export function writeScalingPlan(
  missionId: string,
  participantId: string,
  variants: MovementVariantSelection,
  now: number = Date.now()
): void {
  const key = scalingPlanStorageKey(missionId, participantId);
  if (Object.keys(variants).length === 0) {
    removeRaw(key);
    return;
  }
  writeRaw(key, JSON.stringify({ at: now, variants } satisfies StoredPlan));
  pruneScalingPlans();
}

export function clearScalingPlan(missionId: string, participantId: string): void {
  removeRaw(scalingPlanStorageKey(missionId, participantId));
}

/** Drops the oldest plans past {@link MAX_STORED_PLANS}. */
export function pruneScalingPlans(): void {
  let keys: string[];
  try {
    const storage = window.localStorage;
    if (!storage) {
      return;
    }
    keys = Object.keys(storage).filter((key) => key.startsWith(`${KEY_PREFIX}:`));
  } catch {
    return;
  }

  if (keys.length <= MAX_STORED_PLANS) {
    return;
  }

  const byAge = keys
    .map((key) => ({ key, at: parsePlan(readRaw(key))?.at ?? 0 }))
    .sort((a, b) => b.at - a.at);

  for (const stale of byAge.slice(MAX_STORED_PLANS)) {
    removeRaw(stale.key);
  }
}

/** Test seam: forget the in-memory fallback between cases. */
export function resetScalingPlanMemory(): void {
  memoryFallback.clear();
}
