import { useId, useState } from 'react';
import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import { ALPHA_MALE_QUOTAS } from '@/lib/hud/classificationQuotas';
import { compareClassificationRank } from '@/lib/hud/compareClassificationRank';
import { checklistTarget, nextTierChecklist } from '@/lib/hud/nextTierChecklist';
import type { ChecklistWorkoutRecommendation } from '@/lib/hud/recommendChecklistWorkouts';
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
  defaultExpanded?: boolean;
  /** Incomplete checklist row id → up to 3 Launch-mission recommendations. */
  recommendationsByRow?: Record<string, ChecklistWorkoutRecommendation[]>;
  /** Creates a mission from the library template and opens the rally point. */
  onLaunchTemplate?: (templateId: string) => void;
  launchingTemplateId?: string | null;
  launchError?: string | null;
}

export function ClassificationBadge({
  classification,
  perceivedClassification = null,
  quotas = ALPHA_MALE_QUOTAS,
  defaultExpanded = false,
  recommendationsByRow = {},
  onLaunchTemplate,
  launchingTemplateId = null,
  launchError = null,
}: ClassificationBadgeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const behind =
    perceivedClassification != null &&
    compareClassificationRank(classification.current, perceivedClassification) < 0;
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
          <p className="text-xs uppercase tracking-wide text-secondary">Classification</p>
          {behind && perceivedClassification ? (
            <p className="text-display text-xl text-ink" data-testid="classification-gap">
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
            <span className="tabular-nums text-ink">{RANK_LABEL[classification.previous]}</span>
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
          <p className="mb-2 text-xs uppercase tracking-wide text-secondary">{nextLabel}</p>
          {launchError ? (
            <p
              className="text-error mb-2 text-sm"
              data-testid="checklist-launch-error"
              role="alert"
            >
              {launchError}
            </p>
          ) : null}
          <ul className="space-y-3">
            {checklist.map((row) => {
              const recommendations = row.met ? [] : (recommendationsByRow[row.id] ?? []);
              return (
                <li key={row.id} className="space-y-2">
                  <div className="flex items-baseline gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="font-mono text-secondary">
                      {row.met ? '✓' : '○'}
                    </span>
                    <span className={row.met ? undefined : 'tabular-nums'}>
                      {row.met
                        ? `${row.required} ${row.label}`.replace(/\s+/g, ' ').trim()
                        : `${row.current} / ${row.required} ${row.label}`}
                    </span>
                  </div>
                  {recommendations.length > 0 ? (
                    <ul
                      className="ml-5 space-y-1.5"
                      data-testid={`checklist-recs-${row.id}`}
                      aria-label={`Recommended workouts for ${row.label}`}
                    >
                      {recommendations.map((rec) => {
                        const launching = launchingTemplateId === rec.templateId;
                        return (
                          <li
                            key={rec.templateId}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs"
                          >
                            <span className="text-secondary">
                              <span className="font-medium text-ink">{rec.name}</span>
                              {' · '}
                              {rec.durationMinutes} min · I{rec.intensityTier}
                              {rec.locked ? ' · recovering' : ''}
                            </span>
                            <button
                              type="button"
                              className="link-accent whitespace-nowrap font-semibold disabled:opacity-50"
                              disabled={launchingTemplateId != null || !onLaunchTemplate}
                              onClick={() => onLaunchTemplate?.(rec.templateId)}
                            >
                              {launching ? 'Launching…' : 'Launch mission'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-secondary" data-testid="quota-note">
            {quotaNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}
