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

function labelFor(track: CampaignTrack): string {
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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Workout styles</p>
        <p className="text-xs text-secondary">
          Pick the styles this campaign trains. Sessions rotate through them, so
          two or three keeps the work varied.
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
                  : 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:border-accent/40 hover:text-ink'
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
            {tracks.map((track) => (
              <li key={trackKey(track)}>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink">
                  {labelFor(track)}
                  <button
                    type="button"
                    className="text-accent"
                    aria-label={`Remove ${labelFor(track)}`}
                    onClick={() =>
                      onChange(tracks.filter((entry) => trackKey(entry) !== trackKey(track)))
                    }
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-error">Pick at least one workout style.</p>
      )}
    </div>
  );
}
