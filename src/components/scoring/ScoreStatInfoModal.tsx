import { useEffect, useId } from 'react';
import type { ScoreStatGuidance } from '@/lib/scoring/scoreStatGuidance';

interface ScoreStatInfoModalProps {
  guidance: ScoreStatGuidance;
  onClose: () => void;
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-secondary">{heading}</h3>
      <p className="text-sm leading-relaxed text-ink">{body}</p>
    </section>
  );
}

export function ScoreStatInfoModal({ guidance, onClose }: ScoreStatInfoModalProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      // normal-case: text-transform inherits, and the trigger this mounts
      // beneath is itself an uppercase label (e.g. "Final score"). Without
      // resetting it here, every word in the modal inherits that transform —
      // the fixed positioning that lifts this out of the label visually does
      // nothing for CSS inheritance, which follows DOM ancestry, not layout.
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 normal-case"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-xl text-ink">
            {guidance.title}
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <Section heading="What it is" body={guidance.whatItIs} />
        <Section heading="How it's calculated" body={guidance.howItsCalculated} />

        {guidance.table ? (
          <div className="overflow-hidden rounded-card border border-border">
            <table className="w-full text-sm">
              <caption className="border-b border-border bg-page px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
                {guidance.table.caption}
              </caption>
              <tbody>
                {guidance.table.rows.map((row) => (
                  <tr key={row.label} className="border-t border-border first:border-t-0">
                    <td className="px-3 py-1.5 text-secondary">{row.label}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Section heading="What it measures" body={guidance.whatItMeasures} />

        <section className="space-y-1 rounded-card border border-[color:color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-accent-tint p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-accent">How to use it</h3>
          <p className="text-sm leading-relaxed text-ink">{guidance.howToUseIt}</p>
        </section>
      </div>
    </div>
  );
}
