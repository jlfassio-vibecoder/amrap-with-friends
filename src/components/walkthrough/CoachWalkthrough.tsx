import { useId, useLayoutEffect, useState } from 'react';
import {
  walkthroughTargetSelector,
  type StagingWalkthroughStep,
} from './stagingWalkthrough';

const HIGHLIGHT_PAD = 8;
const BUBBLE_GAP = 12;
const BUBBLE_WIDTH = 320;

interface CoachWalkthroughProps {
  step: StagingWalkthroughStep;
  onNext: () => void;
  onSkip: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface BubblePos {
  top: number;
  left: number;
}

function getTargetElement(targetId: string): HTMLElement | null {
  const element = document.querySelector(walkthroughTargetSelector(targetId));
  return element instanceof HTMLElement ? element : null;
}

function measureTarget(targetId: string): HighlightRect | null {
  const element = getTargetElement(targetId);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(0, rect.top - HIGHLIGHT_PAD),
    left: Math.max(0, rect.left - HIGHLIGHT_PAD),
    width: rect.width + HIGHLIGHT_PAD * 2,
    height: rect.height + HIGHLIGHT_PAD * 2,
  };
}

function placeBubble(highlight: HighlightRect): BubblePos {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const estimatedHeight = 220;
  const spaceBelow = viewportHeight - (highlight.top + highlight.height);
  const preferBelow = spaceBelow >= estimatedHeight + BUBBLE_GAP;

  const top = preferBelow
    ? highlight.top + highlight.height + BUBBLE_GAP
    : Math.max(16, highlight.top - estimatedHeight - BUBBLE_GAP);

  const left = Math.min(
    Math.max(16, highlight.left),
    Math.max(16, viewportWidth - BUBBLE_WIDTH - 16)
  );

  return { top, left };
}

function CoachChip() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
        aria-hidden
      >
        C
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-secondary">
        Coach
      </span>
    </div>
  );
}

export function CoachWalkthrough({ step, onNext, onSkip }: CoachWalkthroughProps) {
  const titleId = useId();
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [bubble, setBubble] = useState<BubblePos>({ top: 24, left: 16 });

  useLayoutEffect(() => {
    const element = getTargetElement(step.targetId);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function update() {
      const nextHighlight = measureTarget(step.targetId);
      setHighlight(nextHighlight);
      if (nextHighlight) {
        setBubble(placeBubble(nextHighlight));
      }
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.id, step.targetId]);

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden"
      data-testid="coach-walkthrough"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-card ring-2 ring-accent"
          data-testid="coach-walkthrough-highlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: '0 0 0 9999px var(--color-scrim)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim" />
      )}
      <div
        className="absolute z-10 w-[min(100%-2rem,20rem)]"
        style={{ top: bubble.top, left: bubble.left }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card space-y-3 p-4">
          <CoachChip />
          <h2 id={titleId} className="text-display text-lg text-ink">
            {step.title}
          </h2>
          <p className="text-sm leading-relaxed text-secondary">{step.body}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={onNext}
            >
              Next
            </button>
            <button type="button" className="btn-outline" onClick={onSkip}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
