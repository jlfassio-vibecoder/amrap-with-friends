interface SmartRecoveryToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isAuthenticated: boolean;
  loading?: boolean;
  error?: string | null;
}

const RULES_TOOLTIP =
  'Locks recently completed workouts (6 days), high-intensity missions (72 hours), and overlapping movement patterns (48 hours).';

export function SmartRecoveryToggle({
  enabled,
  onChange,
  isAuthenticated,
  loading = false,
  error = null,
}: SmartRecoveryToggleProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable Smart Recovery"
          disabled={!isAuthenticated}
          className={
            enabled
              ? 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-accent transition-colors disabled:opacity-50'
              : 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface transition-colors disabled:opacity-50'
          }
          onClick={() => onChange(!enabled)}
        >
          <span
            className={
              enabled
                ? 'inline-block h-4 w-4 translate-x-6 rounded-full bg-on-accent transition-transform'
                : 'inline-block h-4 w-4 translate-x-1 rounded-full bg-muted transition-transform'
            }
            aria-hidden="true"
          />
        </button>
        <span className="text-sm font-semibold text-ink">Enable Smart Recovery</span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold leading-none text-on-accent"
          aria-label="How Smart Recovery works"
          title={RULES_TOOLTIP}
        >
          ?
        </button>
        {loading ? <span className="text-xs text-muted">Loading recovery history…</span> : null}
      </div>
      {!isAuthenticated ? (
        <p className="text-xs text-secondary">Sign in to enable Smart Recovery</p>
      ) : null}
      {error ? <p className="text-error text-xs">{error}</p> : null}
    </div>
  );
}
