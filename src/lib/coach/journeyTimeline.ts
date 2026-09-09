import { formatCoachLabel } from '@/lib/coach/formatCoachLabel';

export interface JourneyLifetime {
  missionsHosted: number;
  missionsJoined: number;
  missionsTotal: number;
  missionsCompleted: number;
  missionsFinishedState: number;
  bestScore: number | null;
  totalWorkoutMinutes: number;
  activeDays: number;
}

export interface JourneyMissionPayload {
  missionId: string;
  role: string;
  state: string;
  templateId: string | null;
  durationMinutes: number | null;
  intensityTier: number | null;
  finalScore: number | null;
  completed: boolean;
  guest: boolean;
}

export interface JourneyEventPayload {
  eventName: string;
  route: string | null;
  missionId: string | null;
  anonId: string | null;
  signedIn: boolean;
  props: Record<string, unknown>;
}

export type JourneyEntry =
  | { at: string; kind: 'mission'; payload: JourneyMissionPayload }
  | { at: string; kind: 'event'; payload: JourneyEventPayload };

/**
 * Where this person actually got to, in one phrase.
 *
 * The whole point of the journey view is telling apart someone who looked from
 * someone who trained, so the ladder is built on completions first and
 * participation second -- never on event volume, which mostly measures how
 * long a tab stayed open.
 */
export type JourneyStage =
  'browsed' | 'started_never_finished' | 'completed_once' | 'returning' | 'regular';

export function journeyStage(lifetime: JourneyLifetime): JourneyStage {
  if (lifetime.missionsCompleted >= 5) {
    return 'regular';
  }
  if (lifetime.missionsCompleted >= 2) {
    return 'returning';
  }
  if (lifetime.missionsCompleted === 1) {
    return 'completed_once';
  }
  if (lifetime.missionsTotal > 0) {
    return 'started_never_finished';
  }
  return 'browsed';
}

export function journeyStageLabel(stage: JourneyStage): string {
  switch (stage) {
    case 'regular':
      return 'Regular — 5+ missions completed';
    case 'returning':
      return 'Returning — 2+ missions completed';
    case 'completed_once':
      return 'Completed one mission';
    case 'started_never_finished':
      return 'Started a mission, never completed one';
    default:
      return 'Browsed only — never joined a mission';
  }
}

/** A mission the person took part in but never produced a score for. The gap worth chasing. */
export function unfinishedMissionCount(lifetime: JourneyLifetime): number {
  return Math.max(0, lifetime.missionsTotal - lifetime.missionsCompleted);
}

export function journeyEntryLabel(entry: JourneyEntry): string {
  if (entry.kind === 'mission') {
    const role = formatCoachLabel(entry.payload.role);
    const outcome = entry.payload.completed
      ? `completed · score ${entry.payload.finalScore}`
      : `no score · mission ${entry.payload.state}`;
    const duration = entry.payload.durationMinutes ? `${entry.payload.durationMinutes}m ` : '';
    return `${duration}mission as ${role} — ${outcome}`;
  }
  return formatCoachLabel(entry.payload.eventName);
}

/**
 * Identity at the moment of the entry, not today's. A row from before sign-up
 * stays labelled Guest even once the account exists, because the point of the
 * timeline is showing where the account came from.
 */
export function journeyEntryIdentity(entry: JourneyEntry): 'guest' | 'signed_in' {
  if (entry.kind === 'mission') {
    return entry.payload.guest ? 'guest' : 'signed_in';
  }
  return entry.payload.signedIn ? 'signed_in' : 'guest';
}

/** Calendar-day buckets, newest first, so the timeline reads as days rather than a flat list. */
export function groupJourneyByDay(
  entries: JourneyEntry[]
): { day: string; entries: JourneyEntry[] }[] {
  const days: { day: string; entries: JourneyEntry[] }[] = [];
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) {
      last.entries.push(entry);
      continue;
    }
    days.push({ day, entries: [entry] });
  }
  return days;
}
