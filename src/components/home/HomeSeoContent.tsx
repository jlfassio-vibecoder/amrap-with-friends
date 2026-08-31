import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroPath } from '@/components/home/HeroPath';
import { LiveLeaderboardPreview } from '@/components/home/LiveLeaderboardPreview';
import { WorkoutStyleInfoModal } from '@/components/workoutStyle/WorkoutStyleInfoModal';
import { WORKOUT_CATEGORIES, type TimeDomain, type WorkoutCategory } from '@/data/workoutTemplates';

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-accent"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-accent"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 14v4" />
      <path d="M12 9v9" />
      <path d="M17 5v13" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-accent"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </svg>
  );
}

const FEATURES = [
  {
    title: 'Synced live countdown',
    description:
      'Solo or with a crew, everyone watches the same clock — reconciled in real time so no phone runs ahead or behind.',
    Icon: ClockIcon,
  },
  {
    title: 'Live leaderboard',
    description:
      'Log rounds with a single tap. Chase your own score solo, or watch the board update as the whole crew competes on the same AMRAP.',
    Icon: BarChartIcon,
  },
  {
    title: 'A real AMRAP workout library',
    description:
      'Pick programmed AMRAPs across 5, 10, 15, and 20-minute formats — with coaching cues and form instructions whether you train alone or invite friends.',
    Icon: DocumentIcon,
  },
] as const;

export function HomeSeoContent() {
  const navigate = useNavigate();
  const [infoCategory, setInfoCategory] = useState<WorkoutCategory | null>(null);

  function handleBrowse(category: WorkoutCategory, durationMinutes?: TimeDomain) {
    const params = new URLSearchParams({ category });
    if (durationMinutes !== undefined) {
      params.set('duration', String(durationMinutes));
    }
    navigate(`/create?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-16 text-left">
      <section className="grid gap-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-14">
        <div className="space-y-3">
          <p className="eyebrow text-accent">What is an AMRAP?</p>
          <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
            As many rounds. As possible.
          </h2>
        </div>
        <div className="space-y-4">
          <p className="text-base leading-[1.7] text-secondary">
            AMRAP stands for{' '}
            <strong className="font-semibold text-ink">As Many Rounds (or Reps) As Possible</strong>{' '}
            — a timed workout format where you cycle through a short list of exercises for a fixed
            duration, completing as many full rounds as you can before the clock runs out.
          </p>
          <p className="text-base leading-[1.7] text-secondary">
            It&apos;s one of the most popular workout styles in functional fitness because it&apos;s
            simple to set up, scales to any fitness level, and turns a workout into a measurable
            score you can compare against friends.
          </p>
          <p className="text-base leading-[1.7] text-secondary">
            <strong className="font-semibold text-ink">AMRAP With Friends</strong> takes that format
            and makes it social: host a live AMRAP mission, share a code, and everyone&apos;s
            countdown, round count, and leaderboard position update in real time — whether
            you&apos;re all in the same gym or scattered across different time zones.
          </p>
        </div>
      </section>

      <HeroPath />

      <LiveLeaderboardPreview />

      <section className="space-y-6">
        <div className="space-y-3">
          <p className="eyebrow text-accent">The kit</p>
          <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
            Built for training together or solo
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ title, description, Icon }) => (
            <article key={title} className="card space-y-3 p-6">
              <Icon />
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <p className="text-sm text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-3">
          <p className="eyebrow text-accent">The library</p>
          <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
            AMRAP workout styles
          </h2>
        </div>
        <p className="max-w-[38rem] text-[15px] leading-[1.6] text-secondary">
          Every AMRAP in the library is built around a specific training stimulus — from quick
          anaerobic sprints to longer aerobic grinds. Pick one to see what it asks of you:
        </p>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_CATEGORIES.map((category) => {
            const durations = category.availableForDurations.join(', ');
            return (
              <button
                key={category.id}
                type="button"
                className="hover:border-accent/40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:text-ink"
                onClick={() => setInfoCategory(category.id)}
              >
                {category.label} — {durations} min
              </button>
            );
          })}
        </div>
      </section>

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
