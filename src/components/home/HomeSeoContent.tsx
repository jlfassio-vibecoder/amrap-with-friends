import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutStyleInfoModal } from '@/components/workoutStyle/WorkoutStyleInfoModal';
import {
  WORKOUT_CATEGORIES,
  type TimeDomain,
  type WorkoutCategory,
} from '@/data/workoutTemplates';

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
      "Everyone in the session watches the exact same clock, reconciled in real time — no one's phone runs ahead or behind.",
    Icon: ClockIcon,
  },
  {
    title: 'Live leaderboard',
    description:
      'Log rounds with a single tap and watch the leaderboard update as everyone competes for the same AMRAP.',
    Icon: BarChartIcon,
  },
  {
    title: 'A real AMRAP workout library',
    description:
      'Choose from programmed AMRAP workouts across 5, 10, 15, and 20-minute formats, each with coaching cues and form instructions.',
    Icon: DocumentIcon,
  },
] as const;

const PREVIEW_CHARS = 50;

function previewText(text: string, maxChars = PREVIEW_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

function CollapsibleSeoParagraph({
  plainText,
  children,
}: {
  plainText: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = plainText.length > PREVIEW_CHARS;

  return (
    <div className="space-y-1">
      <p className="text-base leading-[1.7] text-secondary">
        {expanded || !needsCollapse ? children : previewText(plainText)}
      </p>
      {needsCollapse ? (
        <button
          type="button"
          className="text-sm font-semibold text-accent hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </div>
  );
}

const AMRAP_DEFINITION_TEXT =
  "AMRAP stands for As Many Rounds (or Reps) As Possible — a timed workout format where you cycle through a short list of exercises for a fixed duration, completing as many full rounds as you can before the clock runs out. It's one of the most popular workout styles in functional fitness because it's simple to set up, scales to any fitness level, and turns a workout into a measurable score you can compare against friends.";

const PRODUCT_PITCH_TEXT =
  "AMRAP With Friends takes that format and makes it social: host a live AMRAP session, share a code, and everyone's countdown, round count, and leaderboard position update in real time — whether you're all in the same gym or scattered across different time zones.";

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
    <div className="flex flex-col gap-14 pb-10 text-left">
      <section className="space-y-4">
        <h1 className="text-display text-4xl text-ink">
          What Is an AMRAP Workout?
        </h1>
        <CollapsibleSeoParagraph plainText={AMRAP_DEFINITION_TEXT}>
          AMRAP stands for{' '}
          <strong className="font-semibold text-ink">
            As Many Rounds (or Reps) As Possible
          </strong>{' '}
          — a timed workout format where you cycle through a short list of
          exercises for a fixed duration, completing as many full rounds as you
          can before the clock runs out. It&apos;s one of the most popular
          workout styles in functional fitness because it&apos;s simple to set
          up, scales to any fitness level, and turns a workout into a measurable
          score you can compare against friends.
        </CollapsibleSeoParagraph>
        <CollapsibleSeoParagraph plainText={PRODUCT_PITCH_TEXT}>
          <strong className="font-semibold text-ink">AMRAP With Friends</strong>{' '}
          takes that format and makes it social: host a live AMRAP session,
          share a code, and everyone&apos;s countdown, round count, and
          leaderboard position update in real time — whether you&apos;re all in
          the same gym or scattered across different time zones.
        </CollapsibleSeoParagraph>
      </section>

      <section className="space-y-5">
        <h2 className="text-display text-[1.75rem] text-ink">
          Built for Training Together
        </h2>
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

      <section className="space-y-4">
        <h2 className="text-display text-[1.75rem] text-ink">
          AMRAP Workout Styles
        </h2>
        <p className="text-[15px] text-secondary">
          Every AMRAP in the library is built around a specific training
          stimulus — from quick anaerobic sprints to longer aerobic grinds:
        </p>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_CATEGORIES.map((category) => {
            const durations = category.availableForDurations.join(', ');
            return (
              <button
                key={category.id}
                type="button"
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:border-accent/40 hover:text-ink"
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
