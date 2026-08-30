import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignRoleBadge } from '@/components/campaign/CampaignRoleBadge';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import type { CampaignOccurrenceEntry } from '@/lib/api/campaigns';
import {
  formatOccurrenceDate,
  groupOccurrencesByWeek,
  type CampaignOccurrenceRole,
} from '@/lib/campaign';

const OCCURRENCE_LABEL: Record<string, string> = {
  planned: 'Planned',
  generated: 'Staging area open',
  done: 'Done',
  skipped: 'Skipped',
};

const WORKOUT_NAMES = new Map(WORKOUT_TEMPLATES.map((template) => [template.id, template.name]));

interface CampaignScheduleSectionProps {
  occurrences: CampaignOccurrenceEntry[];
  roleBySequence: Map<number, CampaignOccurrenceRole>;
  /** Which sessions the viewer is allowed to move. */
  canMove: (occurrence: CampaignOccurrenceEntry) => boolean;
  /** Resolves to an error message, or null when the move went through. */
  onMove: (occurrenceId: string, localDate: string, localTime: string) => Promise<string | null>;
}

export function CampaignScheduleSection({
  occurrences,
  roleBySequence,
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
                    <span className="flex items-baseline gap-3 text-sm text-secondary">
                      {occurrence.templateId ? (
                        <span>{WORKOUT_NAMES.get(occurrence.templateId) ?? 'Workout'}</span>
                      ) : null}
                      <span>{occurrence.durationMinutes} min</span>
                      {occurrence.sessionId ? (
                        <Link className="link-accent" to={`/session/${occurrence.sessionId}`}>
                          {OCCURRENCE_LABEL[occurrence.status] ?? occurrence.status}
                        </Link>
                      ) : (
                        <span className="text-xs uppercase tracking-widest text-muted">
                          {OCCURRENCE_LABEL[occurrence.status] ?? occurrence.status}
                        </span>
                      )}
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
                        Keep it between the sessions either side, so the weeks stay in order.
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
