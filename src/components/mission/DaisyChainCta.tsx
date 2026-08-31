import { useId, useState } from 'react';
import { DAISY_CHAIN_LABEL, DAISY_CHAIN_TOOLTIP } from '@/lib/mission/daisyChainCopy';

type DaisyChainCtaProps = {
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  onActivate: () => void | Promise<void>;
};

/**
 * Primary Daisy-chain control with hover/focus help text.
 */
export function DaisyChainCta({
  className = 'btn-primary inline-flex w-full justify-center text-sm',
  disabled = false,
  busy = false,
  onActivate,
}: DaisyChainCtaProps) {
  const tipId = useId();
  const [pending, setPending] = useState(false);
  const isDisabled = disabled || busy || pending;

  async function handleClick() {
    if (isDisabled) {
      return;
    }
    setPending(true);
    try {
      await onActivate();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className={className}
        disabled={isDisabled}
        aria-describedby={tipId}
        onClick={() => void handleClick()}
      >
        {busy || pending ? 'Loading…' : DAISY_CHAIN_LABEL}
      </button>
      <DaisyChainTooltip id={tipId} />
    </div>
  );
}

export function DaisyChainTooltip({ id }: { id: string }) {
  return (
    <p
      id={id}
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-[min(100%,18rem)] -translate-x-1/2 rounded-card border border-border bg-surface px-3 py-2 text-left text-xs leading-relaxed text-secondary opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
    >
      {DAISY_CHAIN_TOOLTIP}
    </p>
  );
}
