import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignRoleBadge } from '@/components/campaign/CampaignRoleBadge';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import type { CampaignOccurrenceEntry } from '@/lib/api/campaigns';
import {
  campaignScheduleStatusLabel,
  formatOccurrenceDate,
  groupOccurrencesByWeek,
  type CampaignOccurrenceRole,
} from '@/lib/campaign';

const WORKOUT_NAMES = new Map(WORKOUT_TEMPLATES.map((template) => [template.id, template.name]));

interface CampaignScheduleSectionProps {
  occurrences: CampaignOccurrenceEntry[];
  roleBySequence: Map<number, CampaignOccurrenceRole>;
  /** Occurrence ids the viewer still owes (any position in the makeup queue). */
  owedOccurrenceIds: Set<string>;
  /** Only the queue head may be skipped (matches RPC). */
  owedHeadOccurrenceId: string | null;
  /** Occurrences the viewer has a usable score for (live or makeup). */
  viewerCompletedOccurrenceIds: Set<string>;
  /** Makeup mission ids keyed by occurrence, for linking Done when the crew never ran it. */
  viewerMakeupMissionByOccurrenceId: Map<string, string>;
  makeupBusy: boolean;
  /** When true, the head owed row already has an open makeup mission. */
  headHasOpenMakeup?: boolean;
  onMakeUp: (occurrenceId: string) => void;
  onSkip: (occurrenceId: string) => void;
  /** Which missions the viewer is allowed to move. */
  canMove: (occurrence: CampaignOccurrenceEntry) => boolean;
  /** Resolves to an error message, or null when the move went through. */
  onMove: (occurrenceId: string, localDate: string, localTime: string) => Promise<string | null>;
}

export function CampaignScheduleSection({
  occurrences,
  roleBySequence,
  owedOccurrenceIds,
  owedHeadOccurrenceId,
  viewerCompletedOccurrenceIds,
  viewerMakeupMissionByOccurrenceId,
  makeupBusy,
  headHasOpenMakeup = false,
  onMakeUp,
  onSkip,
  canMove,
  onMove,
}: CampaignScheduleSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = groupOccurrencesByWeek(occurrences);

  function startEditing(occurrence: CampaignOccurrenceEntry) {
    setEditingId(occurrence.occurrenceId);
    setDraftDate(occurrence.localDate);
    setDraftTime(occurrence.localTime);
    setError(null);
  }

  async function save(occurrenceId: string) {
    setSaving(true);
    const message = await onMove(occurrenceId, draftDate, draftTime);
    setSaving(false);
    setError(message);
    if (message === null) {
      setEditingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-display text-xl text-ink">The schedule</h2>
      {weeks.map((week) => (
        <div key={week.weekNumber} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
            Week {week.weekNumber}
          </p>
          <ul className="divide-y divide-divider rounded-card border border-border bg-surface">
            {week.occurrences.map((occurrence) => {
              const editing = editingId === occurrence.occurrenceId;
              const isOwed = owedOccurrenceIds.has(occurrence.occurrenceId);
              const isHead = owedHeadOccurrenceId === occurrence.occurrenceId;
              const viewerCompleted = viewerCompletedOccurrenceIds.has(occurrence.occurrenceId);
              const statusLabel = campaignScheduleStatusLabel({
                status: occurrence.status,
                viewerCompleted,
              });
              const linkMissionId =
                occurrence.missionId ??
                viewerMakeupMissionByOccurrenceId.get(occurrence.occurrenceId) ??
                null;
              return (
                <li key={occurrence.occurrenceId} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
                      {formatOccurrenceDate(occurrence.localDate)}
                      <span className="font-normal text-secondary">{occurrence.localTime}</span>
                      <CampaignRoleBadge
                        role={roleBySequence.get(occurrence.sequence) ?? 'build'}
                      />
                    </span>
                    <span className="flex flex-wrap items-baseline gap-3 text-sm text-secondary">
                      {occurrence.templateId ? (
                        <span>{WORKOUT_NAMES.get(occurrence.templateId) ?? 'Workout'}</span>
                      ) : null}
                      <span>{occurrence.durationMinutes} min</span>
                      {linkMissionId ? (
                        <Link className="link-accent" to={`/mission/${linkMissionId}`}>
                          {statusLabel}
                        </Link>
                      ) : viewerCompleted ? (
                        <span className="text-sm font-semibold text-accent">{statusLabel}</span>
                      ) : (
                        <span className="text-xs uppercase tracking-widest text-muted">
                          {statusLabel}
                        </span>
                      )}
                      {isOwed ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-accent"
                          disabled={makeupBusy || !isHead}
                          title={isHead ? undefined : 'Make up the oldest mission you owe first.'}
                          onClick={() => onMakeUp(occurrence.occurrenceId)}
                        >
                          {isHead && headHasOpenMakeup ? 'Continue makeup' : 'Make this up'}
                        </button>
                      ) : null}
                      {isHead ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-secondary"
                          disabled={makeupBusy}
                          onClick={() => onSkip(occurrence.occurrenceId)}
                        >
                          Skip
                        </button>
                      ) : null}
                      {canMove(occurrence) && !editing ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-accent"
                          onClick={() => startEditing(occurrence)}
                        >
                          Change time
                        </button>
                      ) : null}
                    </span>
                  </div>

                  {editing ? (
                    <div className="space-y-2 rounded-card bg-surface-muted p-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="space-y-1">
                          <span className="block text-xs font-semibold text-ink">Date</span>
                          <input
                            type="date"
                            className="input-field max-w-48"
                            value={draftDate}
                            onChange={(event) => setDraftDate(event.target.value)}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-xs font-semibold text-ink">Time</span>
                          <input
                            type="time"
                            className="input-field max-w-40"
                            value={draftTime}
                            onChange={(event) => setDraftTime(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={saving}
                          onClick={() => void save(occurrence.occurrenceId)}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          disabled={saving}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        Keep it between the missions either side, so the weeks stay in order.
                      </p>
                      {error ? <p className="alert-error">{error}</p> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
