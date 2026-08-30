import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { CampaignSchedulePreview } from '@/components/campaign/CampaignSchedulePreview';
import { CampaignSlotPicker } from '@/components/campaign/CampaignSlotPicker';
import { CampaignTrackPicker } from '@/components/campaign/CampaignTrackPicker';
import { campaignTrackLabel } from '@/components/campaign/campaignTrackLabel';
import { createCampaign } from '@/lib/api/campaigns';
import {
  CAMPAIGN_WEEK_COUNTS,
  CampaignValidationError,
  buildCampaignCalendar,
  calendarDateToday,
  defaultCampaignStartDate,
  formatCampaignShape,
  formatCampaignSpan,
  planCampaignWorkouts,
  suggestedSlots,
  type CampaignSlot,
  type CampaignTrack,
  type CampaignWeekCount,
} from '@/lib/campaign';
import { track as trackEvent } from '@/lib/analytics/track';
import type { CampaignCalendar, PlannedCampaignOccurrence } from '@/lib/campaign';

type CampaignPreview =
  | { kind: 'incomplete' }
  | { kind: 'invalid'; problem: string }
  | { kind: 'ready'; calendar: CampaignCalendar; occurrences: PlannedCampaignOccurrence[] };

export default function CreateCampaignPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [weekCount, setWeekCount] = useState<CampaignWeekCount>(8);
  const [startDate, setStartDate] = useState(() => defaultCampaignStartDate(calendarDateToday()));
  const [slots, setSlots] = useState<CampaignSlot[]>(() => suggestedSlots(3));
  const [tracks, setTracks] = useState<CampaignTrack[]>([
    { durationMinutes: 10, category: 'blood-shunt' },
    { durationMinutes: 15, category: 'engine-room' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recomputed on every edit so the host is always previewing the plan they
  // would actually get, not a stale one.
  const preview: CampaignPreview = useMemo(() => {
    if (slots.length === 0 || tracks.length === 0) {
      return { kind: 'incomplete' };
    }
    try {
      const calendar = buildCampaignCalendar({ weekCount, startDate, slots });
      return {
        kind: 'ready',
        calendar,
        occurrences: planCampaignWorkouts({
          occurrences: calendar.occurrences,
          tracks,
        }),
      };
    } catch (cause) {
      // Validation errors are the host mid-edit (no days picked yet, a style
      // with no workouts); anything else is a real fault and should surface.
      if (cause instanceof CampaignValidationError) {
        return { kind: 'invalid', problem: cause.message };
      }
      throw cause;
    }
  }, [weekCount, startDate, slots, tracks]);

  const planned = preview.kind === 'ready' ? preview : null;
  const previewProblem = preview.kind === 'invalid' ? preview.problem : null;
  const canSubmit = planned !== null && name.trim().length > 0 && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planned) {
      setError(previewProblem ?? 'Finish the schedule before creating the campaign.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await createCampaign({
        name,
        goal,
        weekCount,
        startDate,
        occurrences: planned.occurrences,
      });

      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      trackEvent('campaign_created', {
        week_count: weekCount,
        sessions_per_week: planned.calendar.sessionsPerWeek,
        total_sessions: planned.calendar.totalSessions,
        track_count: tracks.length,
      });
      navigate(`/campaign/${result.data.campaignId}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <NarrowPageLayout
      title="New campaign"
      subtitle="Train together for weeks, not one night"
      contentMaxWidthClassName="max-w-3xl"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="card space-y-5 p-6">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-ink">Campaign name</span>
            <input
              className="input-field"
              value={name}
              maxLength={80}
              required
              placeholder="e.g. Winter Engine Build"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-ink">
              The goal <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              className="input-field min-h-20"
              value={goal}
              maxLength={280}
              placeholder="What does the crew want to be able to do at the end?"
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
        </div>

        <div className="card space-y-5 p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">How long?</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Campaign length">
              {CAMPAIGN_WEEK_COUNTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={weekCount === option}
                  className={
                    weekCount === option
                      ? 'rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-widest text-on-accent'
                      : 'rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink'
                  }
                  onClick={() => setWeekCount(option)}
                >
                  {option} weeks
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-ink">Start date</span>
            <input
              type="date"
              className="input-field max-w-56"
              value={startDate}
              required
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <CampaignSlotPicker slots={slots} onChange={setSlots} />
        </div>

        <div className="card p-6">
          <CampaignTrackPicker tracks={tracks} onChange={setTracks} />
        </div>

        <div className="card space-y-4 p-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">The plan</p>
            {planned ? (
              <>
                <p className="text-sm text-secondary">
                  {formatCampaignShape(weekCount, planned.calendar.sessionsPerWeek)} ·{' '}
                  {formatCampaignSpan(
                    planned.calendar.firstSessionDate,
                    planned.calendar.lastSessionDate
                  )}
                </p>
                {tracks[0] ? (
                  <p className="text-sm text-secondary">
                    Measured on {campaignTrackLabel(tracks[0])}.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-error text-sm">
                {previewProblem ?? 'Pick your training days and workout styles to see the plan.'}
              </p>
            )}
          </div>

          {planned ? (
            <>
              <p className="text-sm text-secondary">
                The first session is your benchmark. You run it again at the end, so the campaign
                finishes with a number rather than a feeling. Everything in between gets steadily
                harder.
              </p>
              <CampaignSchedulePreview occurrences={planned.occurrences} />
            </>
          ) : null}
        </div>

        {error ? <p className="alert-error">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {saving ? 'Creating…' : 'Create campaign'}
          </button>
          <Link className="link-accent text-sm" to="/">
            Cancel
          </Link>
        </div>
      </form>
    </NarrowPageLayout>
  );
}
