/**
 * The athlete-facing activity feed: what each finish reads as, and which row
 * belongs to the person looking.
 *
 * The naming rule is settled in the database, not here — `list_room_activity`
 * returns a nickname only for a current member who has not opted out, and null
 * for everyone else. This file must never try to work out who someone is; by
 * the time a row arrives, anonymity is a fact about it.
 *
 * See docs/plans/coach-rooms-decisions.md §4.
 */

export interface RoomFeedRow {
  participantId: string;
  missionId: string;
  templateId: string | null;
  /** Null for a guest and for a member who opted out — deliberately the same. */
  nickname: string | null;
  score: number | null;
  unit: 'reps' | 'rounds';
  finishedAt: string;
  reactionCount: number;
}

/** What a guest's own device remembers: mission id -> its participant id. */
export type OwnParticipants = (missionId: string) => string | null;

export interface RoomFeedLine {
  row: RoomFeedRow;
  /** Rendered name, never a guess at one. */
  who: string;
  /** The score as the athlete did it — never the adjusted one. */
  what: string;
  /** True when this device ran this finish. Resolved locally; never sent. */
  isMine: boolean;
}

/**
 * The name shown for a row.
 *
 * "An athlete" rather than "Guest" or "Anonymous". An opted-out member and a
 * guest are the same row by design, so the word has to be true of both — and
 * "Guest" would be false for the member and faintly dismissive of the guest,
 * who is the person this feed most needs to reach.
 */
export function feedName(nickname: string | null, isMine: boolean): string {
  const named = (nickname ?? '').trim();
  if (named.length > 0) {
    return named;
  }
  return isMine ? 'You' : 'An athlete';
}

export function feedScore(score: number | null, unit: 'reps' | 'rounds'): string {
  return score === null ? '—' : `${score} ${unit}`;
}

export function feedLines(rows: RoomFeedRow[], own: OwnParticipants): RoomFeedLine[] {
  return rows.map((row) => {
    const isMine = own(row.missionId) === row.participantId;
    return {
      row,
      isMine,
      who: feedName(row.nickname, isMine),
      what: feedScore(row.score, row.unit),
    };
  });
}

/**
 * Whether to invite the viewer to put their name on a result already on the
 * page — the account prompt this feed exists to earn.
 *
 * Only when all three are true: they have a finish here, it is showing
 * unnamed, and they are signed out. A signed-in athlete whose row is unnamed
 * either opted out or has not joined, and neither is answered by "make an
 * account".
 */
export function shouldOfferNaming(lines: RoomFeedLine[], signedIn: boolean): boolean {
  return !signedIn && lines.some((line) => line.isMine && line.row.nickname === null);
}

/** Said once, under the feed, about a result the athlete can already see. */
export const NAMING_PROMPT =
  'That’s your result up there. Create an account and it carries your name — here and on everything you do next.';
