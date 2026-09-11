import { Fragment, useState, type ReactNode } from 'react';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type IntensityTier,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import {
  filterWorkoutTemplates,
  isCategoryAvailable,
  isDurationAvailable,
  categoriesForDuration,
  categoryDisplayForDuration,
  normalizeMissionNameQuery,
} from '@/lib/workout/filterWorkoutTemplates';
import { WorkoutTemplateCard } from '@/components/createMission/WorkoutTemplateCard';
import { TimeDomainInfoModal } from '@/components/createMission/TimeDomainInfoModal';
import { WorkoutStyleInfoModal } from '@/components/workoutStyle/WorkoutStyleInfoModal';
import { guidanceForDomain } from '@/data/timeDomainGuidance';

const INTENSITY_OPTIONS: Array<IntensityTier | null> = [null, 1, 2, 3, 4, 5];

export interface WorkoutBrowserProps {
  durationMinutes: TimeDomain;
  selectedCategory: WorkoutCategory;
  selectedTemplateIds: string[];
  onDurationChange: (duration: TimeDomain) => void;
  onCategoryChange: (category: WorkoutCategory) => void;
  onTemplateSelect: (template: WorkoutTemplate) => void;
  /**
   * Rendered between the intensity chips and the search box. The athlete's
   * create-mission flow puts Smart Recovery here; a host scheduling for their
   * room has nothing to put in it.
   */
  filtersSlot?: ReactNode;
  /**
   * Draws one result. Defaults to a plain card. The athlete flow overrides it
   * to pass classification, quotas and recovery locks -- none of which mean
   * anything when a coach is choosing a workout for other people.
   */
  renderCard?: (template: WorkoutTemplate, selected: boolean) => ReactNode;
}

/**
 * Browsing the workout library: time domain, category, intensity, search, and
 * the grid of results.
 *
 * This was the inside of `WorkoutTemplatePicker`, which did two jobs at once --
 * browsing, and gating results against one athlete's history. That second job
 * is why it took fifteen props, and why a host scheduling a room mission could
 * not use it and got a bare `<select>` of two hundred names instead.
 *
 * The athlete parts are a slot and a card renderer rather than optional props,
 * so this component has no opinion about classification, quotas or recovery
 * and cannot grow one by accident.
 */
export function WorkoutBrowser({
  durationMinutes,
  selectedCategory,
  selectedTemplateIds,
  onDurationChange,
  onCategoryChange,
  onTemplateSelect,
  filtersSlot = null,
  // `onTemplateSelect` is bound by the time this default is evaluated, so the
  // plain card is the zero-configuration case.
  renderCard = (template, selected) => (
    <WorkoutTemplateCard template={template} selected={selected} onSelect={onTemplateSelect} />
  ),
}: WorkoutBrowserProps) {
  const [infoCategory, setInfoCategory] = useState<WorkoutCategory | null>(null);
  const [infoDomain, setInfoDomain] = useState<TimeDomain | null>(null);
  const [intensityTier, setIntensityTier] = useState<IntensityTier | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const searching = normalizeMissionNameQuery(nameQuery).length > 0;
  const selectedDomainGuidance = guidanceForDomain(durationMinutes);

  const visibleTemplates = filterWorkoutTemplates(WORKOUT_TEMPLATES, {
    durationMinutes,
    category: selectedCategory,
    intensityTier,
    nameQuery,
  });
  const visibleCategories = categoriesForDuration(WORKOUT_CATEGORIES, durationMinutes);
  const selectedCategoryMeta = visibleCategories.find(
    (category) => category.id === selectedCategory
  );
  const selectedCategoryDisplay = selectedCategoryMeta
    ? categoryDisplayForDuration(selectedCategoryMeta, durationMinutes)
    : null;

  function handleBrowse(category: WorkoutCategory, soleDuration?: TimeDomain) {
    if (soleDuration !== undefined) {
      onDurationChange(soleDuration);
    }
    onCategoryChange(category);
  }

  function chipClassName(selected: boolean, available: boolean): string {
    if (selected) {
      return 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60';
    }
    if (available) {
      return 'hover:border-accent/40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60';
    }
    return 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted opacity-60';
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Time domain</p>
        <div className="flex flex-wrap gap-2">
          {TIME_DOMAINS.map((duration) => {
            const available = isDurationAvailable(duration, WORKOUT_TEMPLATES);
            const selected = durationMinutes === duration;

            return (
              <div
                key={duration}
                className={`inline-flex items-center gap-1.5 ${
                  selected
                    ? 'rounded-full bg-accent py-2 pl-4 pr-2 text-sm font-semibold text-on-accent'
                    : available
                      ? 'hover:border-accent/40 rounded-full border border-border bg-surface py-2 pl-4 pr-2 text-sm font-semibold text-ink'
                      : 'rounded-full border border-border bg-surface py-2 pl-4 pr-2 text-sm font-semibold text-muted opacity-60'
                }`}
              >
                <button
                  type="button"
                  disabled={!available || searching}
                  className="bg-transparent text-inherit disabled:opacity-60"
                  onClick={() => onDurationChange(duration)}
                >
                  {duration} min
                  {!available ? <span className="ml-1 text-xs uppercase">Soon</span> : null}
                </button>
                <button
                  type="button"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none hover:opacity-80 ${
                    selected ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'
                  }`}
                  aria-label={`What's the ${duration} min domain?`}
                  title={`Learn what the ${duration} min domain is for`}
                  onClick={() => setInfoDomain(duration)}
                >
                  ?
                </button>
              </div>
            );
          })}
        </div>
        {!searching ? (
          <p className="text-sm text-secondary">{selectedDomainGuidance.tagline}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Category</p>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => {
            const available = isCategoryAvailable(category, durationMinutes, WORKOUT_TEMPLATES);
            const selected = selectedCategory === category.id;
            const label = categoryDisplayForDuration(category, durationMinutes).label;

            return (
              <div
                key={category.id}
                className={`inline-flex items-center gap-1.5 ${
                  selected
                    ? 'rounded-full bg-accent py-2 pl-4 pr-2 text-sm font-semibold text-on-accent'
                    : available
                      ? 'hover:border-accent/40 rounded-full border border-border bg-surface py-2 pl-4 pr-2 text-sm font-semibold text-ink'
                      : 'rounded-full border border-border bg-surface py-2 pl-4 pr-2 text-sm font-semibold text-muted opacity-60'
                }`}
              >
                <button
                  type="button"
                  disabled={!available || searching}
                  className="bg-transparent text-inherit disabled:opacity-60"
                  onClick={() => onCategoryChange(category.id)}
                >
                  {label}
                  {!available ? <span className="ml-1 text-xs uppercase">Soon</span> : null}
                </button>
                <button
                  type="button"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none hover:opacity-80 ${
                    selected ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'
                  }`}
                  aria-label={`What's ${label}?`}
                  title={`Learn what the ${label} style is for`}
                  onClick={() => setInfoCategory(category.id)}
                >
                  ?
                </button>
              </div>
            );
          })}
        </div>
        {selectedCategoryDisplay && !searching ? (
          <p className="text-sm text-secondary">{selectedCategoryDisplay.description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Intensity</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Intensity">
          {INTENSITY_OPTIONS.map((tier) => {
            const selected = intensityTier === tier;
            const label = tier === null ? 'Any' : `I${tier}`;

            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                className={chipClassName(selected, true)}
                onClick={() => setIntensityTier(tier)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {filtersSlot}

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Search missions
          </span>
          <input
            type="search"
            className="input-field"
            value={nameQuery}
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder="Mission name"
            aria-label="Search missions"
          />
        </label>
        {searching ? (
          <p className="text-xs text-muted">
            Searching all missions — clear search to use time domain and category.
          </p>
        ) : null}
      </div>

      <div className="max-h-[32rem] overflow-y-auto pr-1">
        {visibleTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleTemplates.map((template) => (
              <Fragment key={template.id}>
                {renderCard(template, selectedTemplateIds.includes(template.id))}
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
            {searching || intensityTier !== null
              ? 'No missions match.'
              : 'No missions available for this time domain and category yet.'}
          </p>
        )}
      </div>

      {infoDomain !== null ? (
        <TimeDomainInfoModal
          domain={infoDomain}
          onClose={() => setInfoDomain(null)}
          onBrowse={onDurationChange}
        />
      ) : null}

      {infoCategory ? (
        <WorkoutStyleInfoModal
          category={infoCategory}
          onClose={() => setInfoCategory(null)}
          onBrowse={handleBrowse}
        />
      ) : null}
    </div>
  );
}
