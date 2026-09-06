import { useId, useState, type ReactNode } from 'react';

interface HudInfoDisclosureProps {
  /** Names the thing being explained, for screen readers. */
  label: string;
  children: ReactNode;
}

/**
 * The ⓘ affordance the HUD cards share.
 *
 * Inline disclosure rather than a dialog: these explanations are read next to
 * the number they describe, and a modal would cover the very figure the reader
 * is trying to understand.
 */
export function HudInfoDisclosure({ label, children }: HudInfoDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-secondary text-[10px] font-semibold leading-none text-secondary hover:border-ink hover:text-ink"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What does ${label} mean?`}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open ? (
        <div
          id={panelId}
          className="mt-2 w-full basis-full space-y-2 rounded-card border border-border bg-surface p-3 text-xs leading-relaxed text-secondary"
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
