import { useId, useState } from 'react';
import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import { ALPHA_MALE_QUOTAS } from '@/lib/hud/classificationQuotas';
import { compareClassificationRank } from '@/lib/hud/compareClassificationRank';
import {
  checklistTarget,
  nextTierChecklist,
} from '@/lib/hud/nextTierChecklist';
import type { ClassificationRank, HudClassification } from '@/lib/hud/types';

const RANK_LABEL: Record<ClassificationRank, string> = {
  unclassified: 'UNCLASSIFIED',
  civilian: 'CIVILIAN',
  operator: 'OPERATOR',
  special_ops: 'SPECIAL OPS',
};

interface ClassificationBadgeProps {
  classification: HudClassification;
  perceivedClassification?: ClassificationRank | null;
  quotas?: ClassificationQuotas;
}

export function ClassificationBadge({
  classification,
  perceivedClassification = null,
  quotas = ALPHA_MALE_QUOTAS,
}: ClassificationBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const behind =
    perceivedClassification != null &&
    compareClassificationRank(classification.current, perceivedClassification) <
      0;
  const target = checklistTarget(
    classification.current,
    behind ? perceivedClassification : undefined
  );
  const checklist = nextTierChecklist(
    classification.current,
    classification.progress,
    quotas,
    behind ? perceivedClassification : undefined
  );

  const nextLabel = behind
    ? `Prove: ${RANK_LABEL[perceivedClassification]}`
    : classification.current === 'special_ops'
      ? 'Maintain SPECIAL OPS'
      : classification.current === 'operator'
        ? 'Next: SPECIAL OPS'
        : classification.current === 'civilian'
          ? 'Next: OPERATOR'
          : 'Next: CIVILIAN';

  const quotaNote =
    target === 'special_ops'
      ? '(Absolute Standard. No Demographic Scaling)'
      : '(Quotas scaled for Demographic Profile)';

  return (
    <div className="border border-border bg-page">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-secondary">
            Classification
          </p>
          {behind && perceivedClassification ? (
            <p
              className="text-display text-xl text-ink"
              data-testid="classification-gap"
            >
              Claimed: {RANK_LABEL[perceivedClassification]} | Verified:{' '}
              {RANK_LABEL[classification.current]}
            </p>
          ) : (
            <p className="text-display text-2xl text-ink" data-testid="classification-current">
              {RANK_LABEL[classification.current]}
            </p>
          )}
          <p className="text-sm text-secondary">
            Previous:{' '}
            <span className="tabular-nums text-ink">
              {RANK_LABEL[classification.previous]}
            </span>
          </p>
        </div>
        <span className="shrink-0 text-xs uppercase tracking-wide text-secondary">
          {expanded ? 'Hide' : 'Checklist'}
        </span>
      </button>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-border px-4 py-3"
          data-testid="classification-checklist"
        >
          <p className="mb-2 text-xs uppercase tracking-wide text-secondary">
            {nextLabel}
          </p>
          <ul className="space-y-2">
            {checklist.map((row) => (
              <li key={row.id} className="flex items-baseline gap-2 text-sm text-ink">
                <span aria-hidden="true" className="font-mono text-secondary">
                  {row.met ? '✓' : '○'}
                </span>
                <span className={row.met ? undefined : 'tabular-nums'}>
                  {row.met
                    ? `${row.required} ${row.label}`.replace(/\s+/g, ' ').trim()
                    : `${row.current} / ${row.required} ${row.label}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-secondary" data-testid="quota-note">
            {quotaNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}
