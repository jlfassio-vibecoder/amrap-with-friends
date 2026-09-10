import { useId, useState, type ReactNode } from 'react';

function CollapsibleSeoParagraph({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="space-y-1">
      <p
        id={panelId}
        className={
          expanded
            ? 'text-base leading-[1.7] text-secondary'
            : 'line-clamp-2 text-base leading-[1.7] text-secondary'
        }
      >
        {children}
      </p>
      <button
        type="button"
        className="text-sm font-semibold text-accent hover:underline"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

/**
 * Homepage “What is an AMRAP?” intro. Full copy stays in the SSR HTML (line-clamp
 * only hides overflow visually) so crawlers still see the SEO paragraphs; readers
 * get a short preview until they expand.
 */
export default function HomeSeoIntro() {
  return (
    <div className="space-y-4">
      <CollapsibleSeoParagraph>
        AMRAP stands for{' '}
        <strong className="font-semibold text-ink">As Many Rounds (or Reps) As Possible</strong> — a
        timed workout format where you cycle through a short list of exercises for a fixed duration,
        completing as many full rounds as you can before the clock runs out.
      </CollapsibleSeoParagraph>
      <CollapsibleSeoParagraph>
        It&apos;s one of the most popular workout styles in functional fitness because it&apos;s
        simple to set up, scales to any fitness level, and turns a workout into a measurable score
        you can compare against friends.
      </CollapsibleSeoParagraph>
      <CollapsibleSeoParagraph>
        <strong className="font-semibold text-ink">AMRAP With Friends</strong> takes that format and
        makes it social: host a live AMRAP mission, share a code, and everyone&apos;s countdown,
        round count, and leaderboard position update in real time — whether you&apos;re all in the
        same gym or scattered across different time zones.
      </CollapsibleSeoParagraph>
    </div>
  );
}
