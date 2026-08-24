import type { ScoreBreakdown } from '@/lib/scoring/types';

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readRoundSplits(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const splits: number[] = [];
  for (const item of value) {
    const duration = readNumber(item);
    if (duration === null || duration < 0 || !Number.isInteger(duration)) {
      return null;
    }
    splits.push(duration);
  }

  return splits;
}

function readOptionalPacingFields(
  row: Record<string, unknown>
): Pick<ScoreBreakdown, 'roundCount' | 'roundSplits'> {
  const roundCountRaw = row.roundCount;
  const roundSplitsRaw = row.roundSplits;

  if (roundCountRaw === undefined && roundSplitsRaw === undefined) {
    return {};
  }

  const roundCount = readNumber(roundCountRaw);
  const roundSplits = readRoundSplits(roundSplitsRaw);

  if (
    roundCount === null ||
    roundCount < 0 ||
    !Number.isInteger(roundCount) ||
    roundSplits === null ||
    roundSplits.length !== roundCount
  ) {
    return {};
  }

  return { roundCount, roundSplits };
}

export function parseScoreBreakdownJson(value: unknown): ScoreBreakdown | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const baseScore = readNumber(row.baseScore);
  const pviMultiplier = readNumber(row.pviMultiplier);
  const domainWeight = readNumber(row.domainWeight);
  const finalScore = readNumber(row.finalScore);
  const pviRaw = row.pvi;

  if (
    baseScore === null ||
    pviMultiplier === null ||
    domainWeight === null ||
    finalScore === null
  ) {
    return null;
  }

  const pvi =
    pviRaw === null || pviRaw === undefined ? null : readNumber(pviRaw);

  if (pviRaw !== null && pviRaw !== undefined && pvi === null) {
    return null;
  }

  return {
    baseScore,
    pvi,
    pviMultiplier,
    domainWeight,
    finalScore,
    ...readOptionalPacingFields(row),
  };
}
