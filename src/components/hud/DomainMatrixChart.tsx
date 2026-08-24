import { evaluateLoadImbalance } from '@/lib/hud/evaluateLoadImbalance';
import type { HudCoreDomain, HudDomainMinutes } from '@/lib/hud/types';

interface DomainMatrixChartProps {
  domainMinutes30d: HudDomainMinutes;
}

const CORE_SEGMENTS: Array<{ domain: HudCoreDomain; label: string }> = [
  { domain: 5, label: 'Sprint' },
  { domain: 10, label: 'Crucible' },
  { domain: 15, label: 'Grind' },
  { domain: 20, label: 'Marathon' },
];

const BAR_WIDTH = 360;
const BAR_HEIGHT = 24;

export function DomainMatrixChart({ domainMinutes30d }: DomainMatrixChartProps) {
  const imbalance = evaluateLoadImbalance(domainMinutes30d);
  const coreTotal =
    domainMinutes30d[5] +
    domainMinutes30d[10] +
    domainMinutes30d[15] +
    domainMinutes30d[20];

  let cursorX = 0;
  const segments = CORE_SEGMENTS.map(({ domain, label }) => {
    const minutes = domainMinutes30d[domain];
    const width =
      coreTotal > 0 ? (minutes / coreTotal) * BAR_WIDTH : BAR_WIDTH / CORE_SEGMENTS.length;
    const x = cursorX;
    cursorX += width;
    return { domain, label, minutes, x, width };
  });

  return (
    <section className="card space-y-3 p-4" aria-label="30-day domain matrix">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        30-day domain matrix
      </p>

      <svg
        role="img"
        aria-label="Domain volume segmented bar"
        viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
        className="h-auto w-full text-accent"
      >
        <rect
          x={0}
          y={0}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          className="fill-page stroke-border"
          strokeWidth={1}
        />
        {coreTotal > 0
          ? segments.map((segment) => (
              <rect
                key={segment.domain}
                x={segment.x}
                y={0}
                width={Math.max(segment.width, 0)}
                height={BAR_HEIGHT}
                className="fill-current"
                opacity={0.35 + (segment.domain / 20) * 0.65}
              />
            ))
          : null}
      </svg>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {segments.map((segment) => (
          <div key={segment.domain}>
            <p className="font-medium uppercase tracking-wide text-muted">
              {segment.domain} {segment.label}
            </p>
            <p className="text-display tabular-nums text-ink">{segment.minutes} min</p>
          </div>
        ))}
      </div>

      {coreTotal === 0 ? (
        <p className="text-sm text-secondary">
          No locked core-domain volume in the last 30 days.
        </p>
      ) : null}

      {domainMinutes30d.other > 0 ? (
        <p className="text-sm text-secondary tabular-nums">
          Other: {domainMinutes30d.other} min
        </p>
      ) : null}

      {imbalance.imbalanced ? (
        <p className="text-sm text-error">{imbalance.warning}</p>
      ) : null}
    </section>
  );
}
