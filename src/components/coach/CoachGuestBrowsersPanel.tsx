import { useEffect, useState } from 'react';
import { CoachGuestBrowsersChart } from '@/components/coach/CoachGuestBrowsersChart';
import {
  fetchCoachChartNotesForRange,
  fetchCoachGuestBrowsersSeries,
  upsertCoachChartNote,
  type CoachGuestBrowsersSeries,
} from '@/lib/api/coach';
import {
  DEFAULT_GUEST_BROWSERS_WINDOW,
  formatGuestBrowsersBucket,
  guestBrowsersCountLabel,
  GUEST_BROWSERS_CHART_METRIC,
  GUEST_BROWSERS_WINDOWS,
  notesByBucketFromList,
  type GuestBrowsersWindow,
} from '@/lib/coach/guestBrowsersWindows';

interface CoachGuestBrowsersPanelProps {
  onDismiss: () => void;
}

export function CoachGuestBrowsersPanel({ onDismiss }: CoachGuestBrowsersPanelProps) {
  const [windowId, setWindowId] = useState<GuestBrowsersWindow>(DEFAULT_GUEST_BROWSERS_WINDOW);
  const [series, setSeries] = useState<CoachGuestBrowsersSeries | null>(null);
  const [notesByBucket, setNotesByBucket] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucketStart, setSelectedBucketStart] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleWindowChange(next: GuestBrowsersWindow) {
    if (next === windowId) {
      return;
    }
    setWindowId(next);
    setLoading(true);
    setError(null);
    setSelectedBucketStart(null);
    setDraft('');
    setSaveError(null);
  }

  function handleSelectBucket(bucketStart: string) {
    setSelectedBucketStart(bucketStart);
    setDraft(notesByBucket[bucketStart] ?? '');
    setSaveError(null);
  }

  function handleCancelNote() {
    setSelectedBucketStart(null);
    setDraft('');
    setSaveError(null);
  }

  async function handleSaveNote() {
    if (!series || !selectedBucketStart) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await upsertCoachChartNote({
      metric: GUEST_BROWSERS_CHART_METRIC,
      grain: series.grain,
      bucketStart: selectedBucketStart,
      body: draft,
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error.message);
      return;
    }
    setNotesByBucket((current) => {
      const next = { ...current };
      if (result.data?.deleted || !result.data?.note) {
        delete next[selectedBucketStart];
      } else {
        next[selectedBucketStart] = result.data.note.body;
      }
      return next;
    });
    if (result.data?.deleted || !draft.trim()) {
      setDraft('');
    } else if (result.data?.note) {
      setDraft(result.data.note.body);
    }
  }

  async function handleClearNote() {
    if (!series || !selectedBucketStart) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await upsertCoachChartNote({
      metric: GUEST_BROWSERS_CHART_METRIC,
      grain: series.grain,
      bucketStart: selectedBucketStart,
      body: '',
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error.message);
      return;
    }
    setNotesByBucket((current) => {
      const next = { ...current };
      delete next[selectedBucketStart];
      return next;
    });
    setDraft('');
  }

  useEffect(() => {
    let cancelled = false;
    // Copilot suggestion ignored: keep this deviation marker — repo convention documents coach RPC error handling skips in place.
    // Copilot suggestion ignored: callRpc settles RPC failures as { error } rather than reject, matching other coach fetches.
    fetchCoachGuestBrowsersSeries(windowId).then(async (result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setLoading(false);
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        setSeries(null);
        setNotesByBucket({});
        return;
      }

      const nextSeries = result.data;
      const first = nextSeries.points[0]?.bucketStart;
      const last = nextSeries.points[nextSeries.points.length - 1]?.bucketStart;
      let notesMap: Record<string, string> = {};

      if (first && last && nextSeries.points.length <= 90) {
        const notesResult = await fetchCoachChartNotesForRange({
          metric: GUEST_BROWSERS_CHART_METRIC,
          grain: nextSeries.grain,
          from: first,
          to: last,
        });
        if (cancelled) {
          return;
        }
        if (notesResult.data) {
          notesMap = notesByBucketFromList(notesResult.data);
        }
      }

      if (cancelled) {
        return;
      }
      setLoading(false);
      setError(null);
      setSeries(nextSeries);
      setNotesByBucket(notesMap);
    });
    return () => {
      cancelled = true;
    };
  }, [windowId]);

  const selectedPoint =
    series && selectedBucketStart
      ? (series.points.find((point) => point.bucketStart === selectedBucketStart) ?? null)
      : null;
  const selectedHasNote = selectedBucketStart ? Boolean(notesByBucket[selectedBucketStart]) : false;

  return (
    <div className="card space-y-4 p-4" data-testid="coach-guest-browsers-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
            Guest browsers
          </h3>
          <p className="text-sm text-secondary">
            Distinct browsers with unsigned-in product events in the selected range. Hover a bar for
            the count; click to add a shared note.
          </p>
        </div>
        <button type="button" className="text-sm text-secondary hover:text-ink" onClick={onDismiss}>
          Dismiss
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GUEST_BROWSERS_WINDOWS.map((definition) => (
          <button
            key={definition.id}
            type="button"
            className={windowId === definition.id ? 'btn-primary text-sm' : 'btn-outline text-sm'}
            onClick={() => handleWindowChange(definition.id)}
          >
            {definition.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-secondary">Loading guest browsers…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && series ? (
        <div className="space-y-3">
          <p className="text-2xl font-bold tabular-nums text-ink">
            {series.total.toLocaleString()}
          </p>
          <CoachGuestBrowsersChart
            points={series.points}
            grain={series.grain}
            notesByBucket={notesByBucket}
            selectedBucketStart={selectedBucketStart}
            onSelectBucket={series.points.length <= 90 ? handleSelectBucket : undefined}
          />

          {selectedPoint ? (
            <div
              className="space-y-3 rounded-md border border-border p-3"
              data-testid="guest-browsers-note-editor"
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  {formatGuestBrowsersBucket(selectedPoint.bucketStart, series.grain)}
                </p>
                <p className="text-sm text-secondary">
                  {guestBrowsersCountLabel(selectedPoint.count, series.grain)}
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Note
                </span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-ink"
                  maxLength={500}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Add a shared note for this bar…"
                />
              </label>
              {saveError ? <p className="text-error text-sm">{saveError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={saving}
                  onClick={() => {
                    void handleSaveNote();
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {selectedHasNote ? (
                  <button
                    type="button"
                    className="btn-outline text-sm"
                    disabled={saving}
                    onClick={() => {
                      void handleClearNote();
                    }}
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-outline text-sm"
                  disabled={saving}
                  onClick={handleCancelNote}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
