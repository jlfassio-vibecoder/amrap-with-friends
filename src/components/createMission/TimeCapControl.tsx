import { useState } from 'react';
import type { TimeDomain } from '@/data/workoutTemplates';
import { capsForDomain, defaultCapForDomain, type MissionTimeCap } from '@/lib/timeDomains';

interface TimeCapControlProps {
  domain: TimeDomain;
  cap: MissionTimeCap;
  onCapChange: (cap: MissionTimeCap) => void;
  /** The minute a selected library workout is programmed for, if there is one. */
  templateCap?: MissionTimeCap | null;
  templateName?: string | null;
}

/**
 * Adjust the clock without leaving the time domain.
 *
 * Deliberately secondary. The four canonical minutes are what the product is
 * about and they stay the front door — the chips above this are unchanged, and
 * this control reads the canonical minute until somebody opens it. Most hosts
 * will never open it, which is the intended outcome, not a failure of
 * discoverability.
 */
export function TimeCapControl({
  domain,
  cap,
  onCapChange,
  templateCap = null,
  templateName = null,
}: TimeCapControlProps) {
  const caps = capsForDomain(domain);
  const canonical = defaultCapForDomain(domain);
  // Opened by anyone who has already moved off the canonical minute — collapsing
  // the control back over a non-default value would hide the thing it set.
  const [open, setOpen] = useState(cap !== canonical);
  const expanded = open || cap !== canonical;
  const offTemplate = templateCap !== null && cap !== templateCap;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-secondary">
          Time cap <span className="font-semibold text-ink">{cap} min</span>
        </p>
        {expanded ? null : (
          <button
            type="button"
            className="text-sm font-semibold text-accent underline underline-offset-2"
            onClick={() => setOpen(true)}
          >
            Change it
          </button>
        )}
      </div>

      {expanded ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Time cap">
            {caps.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={minutes === cap}
                className={
                  minutes === cap
                    ? 'rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent'
                    : 'hover:border-accent/40 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink'
                }
                onClick={() => onCapChange(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {caps[0]}–{caps[caps.length - 1]} min. To go outside that, pick a different time domain.
          </p>
        </>
      ) : null}

      {offTemplate ? (
        <p className="text-xs text-secondary">
          {templateName ? `${templateName} is written for` : 'This workout is written for'}{' '}
          {templateCap} min. Your personal best is stored against that clock, so there will be no
          ghost to race at {cap} min.
        </p>
      ) : null}
    </div>
  );
}
