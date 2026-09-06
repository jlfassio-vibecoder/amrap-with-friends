import {
  chainAdvisories,
  chainRestPlan,
  chainTotalSec,
  formatRestSec,
  MAX_CHAIN_LENGTH,
} from '@/lib/mission/chainRest';
import type { ChainDraftItem } from '@/lib/mission/chainDraft';
import { capsForDomain, domainForCap, type MissionTimeCap } from '@/lib/timeDomains';

interface MissionChainBuilderProps {
  items: ChainDraftItem[];
  canAdd: boolean;
  isAuthenticated: boolean;
  onAdd: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onCapChange: (index: number, cap: MissionTimeCap) => void;
}

function formatTotalSec(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (seconds === 0) {
    return `${minutes} min`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MissionChainBuilder({
  items,
  canAdd,
  isAuthenticated,
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  onCapChange,
}: MissionChainBuilderProps) {
  const plan = chainRestPlan(
    items.map((item) => ({
      durationMinutes: item.durationMinutes,
      intensityTier: item.intensityTier,
    }))
  );
  const advisories = chainAdvisories(
    items.map((item) => ({
      durationMinutes: item.durationMinutes,
      intensityTier: item.intensityTier,
    }))
  );
  const totalSec = items.length > 0 ? chainTotalSec(plan.map((step) => step.mission)) : 0;
  const atMax = items.length >= MAX_CHAIN_LENGTH;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Mission chain</p>
        {isAuthenticated ? (
          <button
            type="button"
            className="btn-outline px-3 py-1.5 text-xs font-semibold"
            disabled={!canAdd}
            onClick={onAdd}
          >
            Add to chain
          </button>
        ) : (
          <p className="text-xs text-secondary">Sign in to chain missions</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-secondary">
          Add up to {MAX_CHAIN_LENGTH} library missions. Rest between them is set automatically.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const restBefore = plan[index]?.restBeforeSec ?? 0;
            const domain = domainForCap(item.durationMinutes);
            const caps = domain !== null ? capsForDomain(domain) : [item.durationMinutes];

            return (
              <li key={item.id} className="space-y-2">
                {index > 0 ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Rest {formatRestSec(restBefore)}
                  </p>
                ) : null}

                <div className="space-y-2 rounded-card border border-border bg-page p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-ink">
                        {index + 1}. {item.name}
                      </p>
                      <p className="text-xs text-secondary">
                        I{item.intensityTier} · {item.durationMinutes} min
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-secondary disabled:opacity-40"
                        disabled={index === 0}
                        aria-label={`Move ${item.name} up`}
                        onClick={() => onMoveUp(index)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-secondary disabled:opacity-40"
                        disabled={index === items.length - 1}
                        aria-label={`Move ${item.name} down`}
                        onClick={() => onMoveDown(index)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-secondary"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => onRemove(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={`${item.name} time cap`}
                  >
                    {caps.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        aria-pressed={minutes === item.durationMinutes}
                        className={
                          minutes === item.durationMinutes
                            ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
                            : 'hover:border-accent/40 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink'
                        }
                        onClick={() => onCapChange(index, minutes)}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {items.length > 0 ? (
        <p className="text-xs text-secondary">
          About {formatTotalSec(totalSec)} total (work + rest). Rest is a coaching default — not
          full recovery.
        </p>
      ) : null}

      {advisories.map((advisory) => (
        <p key={`${advisory.code}-${advisory.index}`} className="text-xs text-secondary">
          {advisory.message}
        </p>
      ))}

      {atMax && isAuthenticated ? (
        <p className="text-xs text-muted">A chain holds at most {MAX_CHAIN_LENGTH} missions.</p>
      ) : null}
    </div>
  );
}
