import { AppLink } from '@/components/AppLink';
import { HudInfoDisclosure } from '@/components/hud/HudInfoDisclosure';
import { brandNameForDomain } from '@/data/timeDomainGuidance';
import {
  DOMAIN_MATRIX_GUIDANCE,
  type DomainMatrixWindowLabel,
} from '@/lib/hud/domainMatrixGuidance';
import { evaluateLoadImbalance } from '@/lib/hud/evaluateLoadImbalance';
import type { HudCoreDomain, HudDomainMinutes } from '@/lib/hud/types';
import { formatCapRange } from '@/lib/timeDomains';

interface DomainMatrixChartProps {
  domainMinutes: HudDomainMinutes;
  windowLabel: DomainMatrixWindowLabel;
}

const CORE_DOMAINS: HudCoreDomain[] = [5, 10, 15, 20];

const BAR_WIDTH = 360;
const BAR_HEIGHT = 24;

function windowPhrase(windowLabel: DomainMatrixWindowLabel): string {
  if (windowLabel === '72-hour') {
    return '72 hours';
  }
  if (windowLabel === '7-day') {
    return '7 days';
  }
  return '30 days';
}

export function DomainMatrixChart({ domainMinutes, windowLabel }: DomainMatrixChartProps) {
  const imbalance = evaluateLoadImbalance(domainMinutes);
  const coreTotal = domainMinutes[5] + domainMinutes[10] + domainMinutes[15] + domainMinutes[20];
  const phrase = windowPhrase(windowLabel);
  const title = `${windowLabel} domain matrix`;
  const guidance = DOMAIN_MATRIX_GUIDANCE[windowLabel];

  const segments = CORE_DOMAINS.map((domain, index) => {
    const label = brandNameForDomain(domain);
    const minutes = domainMinutes[domain];
    const width =
      coreTotal > 0 ? (minutes / coreTotal) * BAR_WIDTH : BAR_WIDTH / CORE_DOMAINS.length;

    const x = CORE_DOMAINS.slice(0, index).reduce((sum, d) => {
      const prevMinutes = domainMinutes[d];
      const prevWidth =
        coreTotal > 0 ? (prevMinutes / coreTotal) * BAR_WIDTH : BAR_WIDTH / CORE_DOMAINS.length;
      return sum + prevWidth;
    }, 0);

    return { domain, label, minutes, x, width };
  });

  return (
    <section className="card space-y-3 p-4" aria-label={title}>
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
        <HudInfoDisclosure label={guidance.disclosureLabel}>
          {guidance.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p>
            <AppLink className="link-accent" to="/science/energy-systems">
              How energy systems overlap in real workouts
            </AppLink>
          </p>
        </HudInfoDisclosure>
      </div>

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

      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
        {segments.map((segment) => (
          <div key={segment.domain}>
            <p className="font-medium uppercase tracking-wide text-muted">
              {segment.label} {formatCapRange(segment.domain)}
            </p>
            <p className="text-display tabular-nums text-ink">{segment.minutes} min</p>
          </div>
        ))}
        <div>
          <p className="font-medium uppercase tracking-wide text-muted">Active Recovery</p>
          <p className="text-display tabular-nums text-ink">{domainMinutes.activeRecovery} min</p>
        </div>
      </div>

      {coreTotal === 0 && domainMinutes.activeRecovery === 0 ? (
        <p className="text-sm text-secondary">No locked core-domain volume in the last {phrase}.</p>
      ) : null}

      {coreTotal === 0 && domainMinutes.activeRecovery > 0 ? (
        <p className="text-sm text-secondary">
          Only Active Recovery volume in the last {phrase} — no Sprint through Marathon lock yet.
        </p>
      ) : null}

      {domainMinutes.other > 0 ? (
        <p className="text-sm tabular-nums text-secondary">Other: {domainMinutes.other} min</p>
      ) : null}

      {imbalance.imbalanced ? <p className="text-error text-sm">{imbalance.warning}</p> : null}
    </section>
  );
}
