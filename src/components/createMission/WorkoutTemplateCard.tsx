import type { KeyboardEvent } from 'react';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { ExerciseInfoTrigger } from '@/components/exerciseInfo/ExerciseInfoTrigger';
import { getTemplatePrescription } from '@/lib/hud/getTemplatePrescription';
import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import { ALPHA_MALE_QUOTAS } from '@/lib/hud/classificationQuotas';
import type { ClassificationRank, HudClassification } from '@/lib/hud/types';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';
import { formatRecoveryLockMessage } from '@/lib/smartRecovery/formatRecoveryRemaining';
import { formatTemplateMovementLine } from '@/lib/workout/templateToExercises';

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  selected: boolean;
  onSelect: (template: WorkoutTemplate) => void;
  classification?: HudClassification | null;
  perceivedClassification?: ClassificationRank | null;
  quotas?: ClassificationQuotas;
  recoveryLock?: TemplateRecoveryLock | null;
  smartRecoveryActive?: boolean;
}

export function WorkoutTemplateCard({
  template,
  selected,
  onSelect,
  classification = null,
  perceivedClassification = null,
  quotas = ALPHA_MALE_QUOTAS,
  recoveryLock = null,
  smartRecoveryActive = false,
}: WorkoutTemplateCardProps) {
  const intensityTier = template.intensityTier;
  const locked = smartRecoveryActive && recoveryLock !== null;
  const prescription = classification
    ? getTemplatePrescription(
        template,
        classification.current,
        classification.progress,
        quotas,
        perceivedClassification
      )
    : { required: false as const };

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (locked) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(template);
    }
  }

  function handleClick() {
    if (locked) {
      return;
    }
    onSelect(template);
  }

  return (
    <div
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={locked}
      className={
        locked
          ? 'card relative w-full cursor-not-allowed space-y-3 p-4 text-left opacity-50'
          : selected
            ? 'card relative w-full cursor-pointer space-y-3 border-2 border-accent p-4 text-left shadow-card'
            : 'card hover:border-accent/40 relative w-full cursor-pointer space-y-3 p-4 text-left'
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {selected ? (
        <span
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : null}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 pr-8">
          <h3 className="text-display text-base text-ink">{template.name}</h3>
          <span
            className="shrink-0 font-mono text-xs tabular-nums text-secondary"
            title={`Intensity ${intensityTier}`}
          >
            I{intensityTier}
          </span>
        </div>
        {prescription.required ? (
          <span
            className="inline-block bg-accent px-2 py-1 text-xs font-bold uppercase tracking-widest text-page"
            data-testid="mandate-badge"
          >
            {prescription.label}
          </span>
        ) : null}
        {locked && recoveryLock ? (
          <p
            className="flex items-center gap-1.5 text-xs text-secondary"
            data-testid="recovery-lock-message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 shrink-0"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {formatRecoveryLockMessage(recoveryLock, new Date())}
          </p>
        ) : null}
        {template.focus ? (
          <span className="inline-block rounded-full border border-border bg-page px-2 py-0.5 text-xs font-semibold text-secondary">
            {template.focus}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1 text-sm text-ink">
        {template.movements.map((movement) => (
          <li
            key={`${template.id}-${movement.name}`}
            className="flex items-center justify-between gap-2"
          >
            <span>{formatTemplateMovementLine(movement)}</span>
            <ExerciseInfoTrigger name={movement.name} size="sm" />
          </li>
        ))}
      </ul>
      <p className="text-xs italic text-secondary">{template.tacticalNote}</p>
    </div>
  );
}
