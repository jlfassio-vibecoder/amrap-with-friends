import { useEffect, useState } from 'react';
import { computeTimeSinceLastBurn } from '@/lib/hud/computeTimeSinceLastBurn';
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
  const { status, label } = computeTimeSinceLastBurn(lastLockedAt, nowMs);

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
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Daily status
        </p>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(status)}`}
        >
          {statusLabel(status)}
        </p>
      </div>
      <p className="text-display text-3xl tabular-nums text-ink">{label}</p>
    </section>
  );
}
