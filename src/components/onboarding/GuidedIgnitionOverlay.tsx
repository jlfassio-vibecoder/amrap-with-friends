export interface GuidedIgnitionOverlayProps {
  onSelect: (templateId: string) => void;
  onSkip: () => void;
}

interface TierOption {
  templateId: string;
  tier: string;
  label: string;
  hook: string;
  duration: string;
  workoutName: string;
  cta: string;
}

const TIERS: TierOption[] = [
  {
    templateId: 'first-contact',
    tier: 'TIER 1',
    label: 'CIVILIAN / RECRUIT',
    hook: "I need a baseline. Let's start the clock.",
    duration: '10 min',
    workoutName: 'First Contact',
    cta: 'Set my baseline',
  },
  {
    templateId: 'steady-altitude',
    tier: 'TIER 2',
    label: 'FIELD READY',
    hook: 'I know my way around the work. Give me a target.',
    duration: '15 min',
    workoutName: 'Steady Altitude',
    cta: 'Give me a target',
  },
  {
    templateId: 'the-undertow',
    tier: 'TIER 3',
    label: 'OPERATOR / SPECIAL OPS',
    hook: 'Put me in the Crucible. No modifications.',
    duration: '15 min',
    workoutName: 'The Undertow',
    cta: 'Put me in the Crucible',
  },
];

export function GuidedIgnitionOverlay({ onSelect, onSkip }: GuidedIgnitionOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Determine Your Baseline"
    >
      <div className="card w-full max-w-lg space-y-6 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <h2 className="text-display text-2xl text-ink">Determine Your Baseline.</h2>
          <p className="text-sm text-secondary">
            Pick your operational tier. Your mission loads instantly.
          </p>
        </div>

        <div className="space-y-3">
          {TIERS.map((tier) => (
            <div
              key={tier.templateId}
              className="space-y-2 rounded-card border border-border bg-page p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {tier.tier}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  — {tier.label}
                </span>
              </div>
              <p className="text-sm italic text-secondary">{tier.hook}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-secondary">
                  {tier.duration} · {tier.workoutName}
                </span>
                <button
                  type="button"
                  className="btn-primary shrink-0 text-sm"
                  onClick={() => onSelect(tier.templateId)}
                >
                  {tier.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-secondary underline underline-offset-2 hover:text-ink"
            onClick={onSkip}
          >
            Skip and browse the full Arsenal (190 missions)
          </button>
        </div>
      </div>
    </div>
  );
}
