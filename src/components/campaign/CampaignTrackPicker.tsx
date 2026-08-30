import { useMemo, useState } from 'react';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
} from '@/data/workoutTemplates';
import {
  categoriesForDuration,
  categoryDisplayForDuration,
  isCategoryAvailable,
} from '@/lib/workout/filterWorkoutTemplates';
import type { CampaignTrack } from '@/lib/campaign';

interface CampaignTrackPickerProps {
  tracks: CampaignTrack[];
  onChange: (tracks: CampaignTrack[]) => void;
}

function trackKey(track: CampaignTrack): string {
  return `${track.durationMinutes}:${track.category}`;
}

/** Display label for a track chip — also used on the create page “Measured on” line. */
export function campaignTrackLabel(track: CampaignTrack): string {
  const meta = WORKOUT_CATEGORIES.find((category) => category.id === track.category);
  const display = meta
    ? categoryDisplayForDuration(meta, track.durationMinutes).label
    : track.category;
  return `${display} · ${track.durationMinutes} min`;
}

export function CampaignTrackPicker({ tracks, onChange }: CampaignTrackPickerProps) {
  const [duration, setDuration] = useState<TimeDomain>(10);

  const available = useMemo(
    () =>
      categoriesForDuration(WORKOUT_CATEGORIES, duration).filter((category) =>
        isCategoryAvailable(category, duration, WORKOUT_TEMPLATES)
      ),
    [duration]
  );

  const chosen = new Set(tracks.map(trackKey));

  function toggle(category: WorkoutCategory) {
    const track: CampaignTrack = { durationMinutes: duration, category };
    if (chosen.has(trackKey(track))) {
      onChange(tracks.filter((entry) => trackKey(entry) !== trackKey(track)));
      return;
    }
    onChange([...tracks, track]);
  }

  function measureOn(index: number) {
    if (index <= 0 || index >= tracks.length) {
      return;
    }
    const next = [...tracks];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Workout styles</p>
        <p className="text-xs text-secondary">
          Pick the styles this campaign trains. Sessions rotate through them, so two or three keeps
          the work varied. The first style is what week one measures.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Session length">
        {TIME_DOMAINS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={duration === option}
            className={
              duration === option
                ? 'rounded-full bg-neutral px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-foreground'
                : 'rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink'
            }
            onClick={() => setDuration(option)}
          >
            {option} min
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((category) => {
          const track: CampaignTrack = { durationMinutes: duration, category: category.id };
          const isChosen = chosen.has(trackKey(track));
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isChosen}
              className={
                isChosen
                  ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
                  : 'hover:border-accent/40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
              }
              onClick={() => toggle(category.id)}
            >
              {categoryDisplayForDuration(category, duration).label}
            </button>
          );
        })}
      </div>

      {tracks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
            In this campaign
          </p>
          <ul className="flex flex-wrap gap-2">
            {tracks.map((track, index) => {
              const isMeasured = index === 0;
              return (
                <li key={trackKey(track)}>
                  <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink">
                    {campaignTrackLabel(track)}
                    {isMeasured ? (
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-accent">
                        Measured on this
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[0.65rem] font-bold uppercase tracking-widest text-accent"
                        aria-label={`Measure on ${campaignTrackLabel(track)}`}
                        onClick={() => measureOn(index)}
                      >
                        Measure on this
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-accent"
                      aria-label={`Remove ${campaignTrackLabel(track)}`}
                      onClick={() =>
                        onChange(tracks.filter((entry) => trackKey(entry) !== trackKey(track)))
                      }
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-error text-sm">Pick at least one workout style.</p>
      )}
    </div>
  );
}
