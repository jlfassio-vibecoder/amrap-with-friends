import type { SmartRecoveryHistoryEntry } from '@/lib/api/smartRecovery';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { MovementPattern } from '@/lib/smartRecovery/movementPatterns';
import {
  EXACT_MATCH_LOCK_MS,
  MOVEMENT_PATTERN_LOCK_MS,
  RECOVERY_LOCK_REASON_PRECEDENCE,
  SEVERE_INTENSITY_LOCK_MS,
  SEVERE_INTENSITY_THRESHOLD,
  lockExpiresAt,
} from '@/lib/smartRecovery/recoveryRules';

export type RecoveryLockReason = 'exact-match' | 'severe-intensity' | 'movement-pattern';

export type TemplateRecoveryLock = {
  templateId: string;
  reason: RecoveryLockReason;
  expiresAt: Date;
  /** Set when reason is movement-pattern — drives UI copy in Phase 4. */
  pattern?: MovementPattern;
};

type RecoveryLockCandidate = {
  templateId: string;
  reason: RecoveryLockReason;
  expiresAt: Date;
  pattern?: MovementPattern;
};

function patternsOverlap(
  templatePatterns: MovementPattern[],
  historicalPatterns: MovementPattern[]
): boolean {
  return templatePatterns.some((pattern) => historicalPatterns.includes(pattern));
}

function isActiveCandidate(candidate: RecoveryLockCandidate, now: Date): boolean {
  return candidate.expiresAt.getTime() > now.getTime();
}

function strictestReason(candidates: RecoveryLockCandidate[]): RecoveryLockReason {
  return candidates.reduce<RecoveryLockReason>(
    (bestReason, candidate) =>
      RECOVERY_LOCK_REASON_PRECEDENCE[candidate.reason] >
      RECOVERY_LOCK_REASON_PRECEDENCE[bestReason]
        ? candidate.reason
        : bestReason,
    candidates[0].reason
  );
}

function pickPatternForLock(
  candidates: RecoveryLockCandidate[],
  winningExpiryMs: number
): MovementPattern | undefined {
  const patternCandidates = candidates
    .filter(
      (candidate) =>
        candidate.reason === 'movement-pattern' &&
        candidate.expiresAt.getTime() === winningExpiryMs &&
        candidate.pattern
    )
    .sort((a, b) => (a.pattern ?? '').localeCompare(b.pattern ?? ''));

  return patternCandidates[0]?.pattern;
}

function mergeCandidatesForTemplate(
  candidates: RecoveryLockCandidate[],
  now: Date
): TemplateRecoveryLock | null {
  const active = candidates.filter((candidate) => isActiveCandidate(candidate, now));
  if (active.length === 0) {
    return null;
  }

  const winningExpiryMs = Math.max(...active.map((candidate) => candidate.expiresAt.getTime()));
  const reason = strictestReason(active);
  const expiresAt = new Date(winningExpiryMs);
  const pattern =
    reason === 'movement-pattern' ? pickPatternForLock(active, winningExpiryMs) : undefined;

  return {
    templateId: active[0].templateId,
    reason,
    expiresAt,
    ...(pattern ? { pattern } : {}),
  };
}

function buildRecoveryLockCandidates(
  completion: SmartRecoveryHistoryEntry,
  templates: WorkoutTemplate[],
  patternIndex: Map<string, MovementPattern[]>,
  libraryTemplateIds: Set<string>
): RecoveryLockCandidate[] {
  const candidates: RecoveryLockCandidate[] = [];
  const completedAt = completion.completedAt;

  if (completion.templateId && libraryTemplateIds.has(completion.templateId)) {
    candidates.push({
      templateId: completion.templateId,
      reason: 'exact-match',
      expiresAt: lockExpiresAt(completedAt, EXACT_MATCH_LOCK_MS),
    });
  }

  if (completion.intensityTier >= SEVERE_INTENSITY_THRESHOLD) {
    const severeExpiresAt = lockExpiresAt(completedAt, SEVERE_INTENSITY_LOCK_MS);
    for (const template of templates) {
      if (template.intensityTier >= SEVERE_INTENSITY_THRESHOLD) {
        candidates.push({
          templateId: template.id,
          reason: 'severe-intensity',
          expiresAt: severeExpiresAt,
        });
      }
    }
  }

  const historicalPatterns =
    completion.templateId !== null ? patternIndex.get(completion.templateId) : undefined;

  if (historicalPatterns && historicalPatterns.length > 0) {
    const patternExpiresAt = lockExpiresAt(completedAt, MOVEMENT_PATTERN_LOCK_MS);
    for (const historicalPattern of historicalPatterns) {
      for (const template of templates) {
        const templatePatterns = patternIndex.get(template.id) ?? [];
        if (patternsOverlap(templatePatterns, [historicalPattern])) {
          candidates.push({
            templateId: template.id,
            reason: 'movement-pattern',
            expiresAt: patternExpiresAt,
            pattern: historicalPattern,
          });
        }
      }
    }
  }

  return candidates;
}

export function computeRecoveryLocks(
  completions: SmartRecoveryHistoryEntry[],
  templates: WorkoutTemplate[],
  now: Date,
  patternIndex: Map<string, MovementPattern[]>
): Map<string, TemplateRecoveryLock> {
  const libraryTemplateIds = new Set(templates.map((template) => template.id));
  const candidatesByTemplate = new Map<string, RecoveryLockCandidate[]>();

  for (const completion of completions) {
    const candidates = buildRecoveryLockCandidates(
      completion,
      templates,
      patternIndex,
      libraryTemplateIds
    );

    for (const candidate of candidates) {
      const existing = candidatesByTemplate.get(candidate.templateId) ?? [];
      existing.push(candidate);
      candidatesByTemplate.set(candidate.templateId, existing);
    }
  }

  const locks = new Map<string, TemplateRecoveryLock>();

  for (const [templateId, candidates] of candidatesByTemplate) {
    const lock = mergeCandidatesForTemplate(candidates, now);
    if (lock) {
      locks.set(templateId, lock);
    }
  }

  return locks;
}
