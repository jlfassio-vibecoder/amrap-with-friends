import type { CoachWaitingGraveyardSummary } from '@/lib/api/coach';

interface CoachWaitingGraveyardSummaryCardProps {
  summary: CoachWaitingGraveyardSummary;
  onShowDetail: () => void;
  detailOpen: boolean;
}

export function CoachWaitingGraveyardSummaryCard({
  summary,
  onShowDetail,
  detailOpen,
}: CoachWaitingGraveyardSummaryCardProps) {
  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        Waiting graveyard
      </h3>
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xl font-bold tabular-nums text-ink">
            {summary.waitingOrSetup.toLocaleString()}
          </p>
          <p className="text-xs text-secondary">Waiting / setup</p>
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-ink">
            {summary.olderThan2h.toLocaleString()}
          </p>
          <p className="text-xs text-secondary">Older than 2h</p>
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-ink">
            {summary.olderThan24h.toLocaleString()}
          </p>
          <p className="text-xs text-secondary">Older than 24h</p>
        </div>
      </div>
      <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={onShowDetail}>
        {detailOpen ? 'Hide detail' : 'Show missions stuck over 2h'}
      </button>
    </div>
  );
}
