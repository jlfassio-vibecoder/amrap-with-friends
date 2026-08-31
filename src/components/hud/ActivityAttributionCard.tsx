import { buildActivityAttribution } from '@/lib/hud/activityWindowSummary';

interface ActivityAttributionCardProps {
  inAppMissions: number;
  outsideMissions: number;
  inAppMinutes: number;
  outsideMinutes: number;
}

export function ActivityAttributionCard({
  inAppMissions,
  outsideMissions,
  inAppMinutes,
  outsideMinutes,
}: ActivityAttributionCardProps) {
  const attribution = buildActivityAttribution({
    inAppMissions,
    outsideMissions,
    inAppMinutes,
    outsideMinutes,
  });

  return (
    <section className="card space-y-3 p-4" aria-label="Total activity attribution">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
          Total activity — Last 7 days
        </p>
        <p className="text-sm tabular-nums text-ink">
          {attribution.totalMissions} missions · {attribution.totalMinutes} min
        </p>
      </div>

      {attribution.totalMinutes === 0 ? (
        <p className="text-sm text-secondary">No activity logged in the last 7 days.</p>
      ) : (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-sm border border-border bg-page"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={attribution.totalMinutes}
            aria-valuenow={attribution.totalMinutes}
            aria-label={`Activity attribution: ${attribution.inAppMinutes} in-app minutes, ${attribution.outsideMinutes} outside minutes`}
          >
            {attribution.inAppPercent > 0 ? (
              <div
                className="h-full bg-accent transition-[width] duration-300"
                style={{ width: `${attribution.inAppPercent}%` }}
                data-testid="activity-attribution-in-app"
              />
            ) : null}
            {attribution.outsidePercent > 0 ? (
              <div
                className="h-full bg-success transition-[width] duration-300"
                style={{ width: `${attribution.outsidePercent}%` }}
                data-testid="activity-attribution-outside"
              />
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-accent" aria-hidden />
              In-app · {attribution.inAppMinutes} min · {inAppMissions} missions
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-success" aria-hidden />
              Outside · {attribution.outsideMinutes} min · {outsideMissions} missions
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
