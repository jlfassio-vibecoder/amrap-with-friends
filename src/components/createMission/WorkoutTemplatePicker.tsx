import { WorkoutBrowser } from '@/components/workout/WorkoutBrowser';
import { WorkoutTemplateCard } from '@/components/createMission/WorkoutTemplateCard';
import { SmartRecoveryToggle } from '@/components/createMission/SmartRecoveryToggle';
import type { TimeDomain, WorkoutCategory, WorkoutTemplate } from '@/data/workoutTemplates';
import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import type { ClassificationRank, HudClassification } from '@/lib/hud/types';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';

interface WorkoutTemplatePickerProps {
  durationMinutes: TimeDomain;
  selectedCategory: WorkoutCategory;
  selectedTemplateIds: string[];
  classification?: HudClassification | null;
  perceivedClassification?: ClassificationRank | null;
  quotas?: ClassificationQuotas;
  smartRecoveryEnabled: boolean;
  onSmartRecoveryEnabledChange: (enabled: boolean) => void;
  recoveryLocks: Map<string, TemplateRecoveryLock>;
  smartRecoveryActive: boolean;
  smartRecoveryLoading?: boolean;
  smartRecoveryError?: string | null;
  isAuthenticated: boolean;
  onDurationChange: (duration: TimeDomain) => void;
  onCategoryChange: (category: WorkoutCategory) => void;
  onTemplateSelect: (template: WorkoutTemplate) => void;
}

/**
 * The athlete's picker: the shared browser, plus everything that depends on
 * whose history it is.
 *
 * The browsing half now lives in `WorkoutBrowser` so a host scheduling a room
 * mission can reuse it. What stays here is the part that only makes sense for
 * one signed-in athlete -- Smart Recovery, classification, quotas, and the
 * locks that grey out a workout they should not repeat yet.
 */
export function WorkoutTemplatePicker({
  durationMinutes,
  selectedCategory,
  selectedTemplateIds,
  classification = null,
  perceivedClassification = null,
  quotas,
  smartRecoveryEnabled,
  onSmartRecoveryEnabledChange,
  recoveryLocks,
  smartRecoveryActive,
  smartRecoveryLoading = false,
  smartRecoveryError = null,
  isAuthenticated,
  onDurationChange,
  onCategoryChange,
  onTemplateSelect,
}: WorkoutTemplatePickerProps) {
  return (
    <WorkoutBrowser
      durationMinutes={durationMinutes}
      selectedCategory={selectedCategory}
      selectedTemplateIds={selectedTemplateIds}
      onDurationChange={onDurationChange}
      onCategoryChange={onCategoryChange}
      onTemplateSelect={onTemplateSelect}
      filtersSlot={
        <SmartRecoveryToggle
          enabled={smartRecoveryEnabled}
          onChange={onSmartRecoveryEnabledChange}
          isAuthenticated={isAuthenticated}
          loading={smartRecoveryLoading}
          error={smartRecoveryError}
        />
      }
      renderCard={(template, selected) => (
        <WorkoutTemplateCard
          template={template}
          selected={selected}
          classification={classification}
          perceivedClassification={perceivedClassification}
          quotas={quotas}
          recoveryLock={recoveryLocks.get(template.id) ?? null}
          smartRecoveryActive={smartRecoveryActive}
          onSelect={onTemplateSelect}
        />
      )}
    />
  );
}
