import { useEffect, useState } from 'react';
import {
  computeTimeSinceLastBurn,
  DETRAINING_AFTER_HOURS,
  DORMANT_AFTER_HOURS,
} from '@/lib/hud/computeTimeSinceLastBurn';
import { HudInfoDisclosure } from '@/components/hud/HudInfoDisclosure';
import type { HudDailyStatus } from '@/lib/hud/types';

interface DailyTelemetryProps {
  lastLockedAt: string | null;
}

function statusBadgeClass(status: HudDailyStatus): string {
  switch (status) {
    case 'active':
      return 'text-accent';
    case 'dormant':
      return 'text-muted';
    case 'detraining':
      return 'text-error';
    case 'never':
      return 'text-secondary';
  }
}

function statusLabel(status: HudDailyStatus): string {
  return status.toUpperCase();
}

export function DailyTelemetry({ lastLockedAt }: DailyTelemetryProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { status, label, caption } = computeTimeSinceLastBurn(lastLockedAt, nowMs);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card space-y-3 p-4" aria-label="Daily telemetry">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Time since last mission
          </p>
          <HudInfoDisclosure label="time since last mission">
            <p>
              This clock counts <span className="font-semibold text-ink">up</span> from the moment
              you last locked a mission to your account. Practice runs and unsaved workouts do not
              reset it.
            </p>
            <p>
              Under {DORMANT_AFTER_HOURS}h reads{' '}
              <span className="font-semibold text-ink">Active</span>. Between {DORMANT_AFTER_HOURS}h
              and {DETRAINING_AFTER_HOURS}h reads{' '}
              <span className="font-semibold text-ink">Dormant</span>. Past {DETRAINING_AFTER_HOURS}
              h reads <span className="font-semibold text-ink">Detraining</span>.
            </p>
            <p>
              Detraining is about the gap, not the effort — it clears the moment you finish and save
              any mission, at any length or intensity.
            </p>
          </HudInfoDisclosure>
        </div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(status)}`}>
          {statusLabel(status)}
        </p>
      </div>
      <div>
        <p className="text-display text-3xl tabular-nums text-ink">{label}</p>
        <p className="text-xs text-secondary">{caption}</p>
      </div>
    </section>
  );
}
