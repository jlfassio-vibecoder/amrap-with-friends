import type {
  LeaderboardEntry,
  SessionPresenceEntry,
} from '@/lib/sessionSync/types';

export type LeaderboardSortMode = 'absolute' | 'discipline';

export interface ParticipantRosterEntry {
  participantId: string;
  nickname: string;
  roundCount: number;
  baseScore: number;
  finalScore: number;
  pvi: number | null;
  pviMultiplier: number;
  pviClassification: string;
  pviVerdict: string;
  isOnline: boolean;
  isSelf: boolean;
  rank: number;
}

interface RosterMergeEntry {
  participantId: string;
  nickname: string;
  roundCount: number;
  baseScore: number;
  finalScore: number;
  pvi: number | null;
  pviMultiplier: number;
  pviClassification: string;
  pviVerdict: string;
  isOnline: boolean;
}

const AVATAR_PALETTE = [
  'bg-avatar-coral',
  'bg-avatar-plum',
  'bg-avatar-teal',
  'bg-avatar-ochre',
  'bg-avatar-sage',
  'bg-avatar-slate',
] as const;

function hashParticipantId(participantId: string): number {
  let hash = 0;
  for (let index = 0; index < participantId.length; index += 1) {
    hash = (hash * 31 + participantId.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getParticipantInitial(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return '?';
  }

  return trimmed.charAt(0).toUpperCase();
}

export function getParticipantAvatarColor(participantId: string): string {
  const index = hashParticipantId(participantId) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

export function compareAbsoluteRoster(a: RosterMergeEntry, b: RosterMergeEntry): number {
  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  if (b.baseScore !== a.baseScore) {
    return b.baseScore - a.baseScore;
  }

  return a.nickname.localeCompare(b.nickname);
}

export function compareDisciplineRoster(a: RosterMergeEntry, b: RosterMergeEntry): number {
  const pviA = a.pvi ?? Number.POSITIVE_INFINITY;
  const pviB = b.pvi ?? Number.POSITIVE_INFINITY;

  if (pviA !== pviB) {
    return pviA - pviB;
  }

  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  return a.nickname.localeCompare(b.nickname);
}

export function buildParticipantRoster(
  leaderboard: LeaderboardEntry[],
  presence: SessionPresenceEntry[],
  selfParticipantId: string,
  sortMode: LeaderboardSortMode = 'absolute'
): ParticipantRosterEntry[] {
  const byId = new Map<string, RosterMergeEntry>();

  for (const entry of leaderboard) {
    byId.set(entry.participantId, {
      participantId: entry.participantId,
      nickname: entry.nickname,
      roundCount: entry.roundCount,
      baseScore: entry.baseScore,
      finalScore: entry.finalScore,
      pvi: entry.pvi,
      pviMultiplier: entry.pviMultiplier,
      pviClassification: entry.pviClassification,
      pviVerdict: entry.pviVerdict,
      isOnline: false,
    });
  }

  for (const entry of presence) {
    const existing = byId.get(entry.participantId);
    if (existing) {
      existing.isOnline = entry.isOnline;
      if (!existing.nickname) {
        existing.nickname = entry.nickname;
      }
      continue;
    }

    byId.set(entry.participantId, {
      participantId: entry.participantId,
      nickname: entry.nickname,
      roundCount: 0,
      baseScore: 0,
      finalScore: 0,
      pvi: null,
      pviMultiplier: 1.0,
      pviClassification: 'Insufficient Data',
      pviVerdict: '',
      isOnline: entry.isOnline,
    });
  }

  const entries = [...byId.values()];
  const filtered =
    sortMode === 'discipline'
      ? entries.filter((entry) => entry.pvi !== null)
      : entries;

  const sorted = [...filtered].sort(
    sortMode === 'discipline' ? compareDisciplineRoster : compareAbsoluteRoster
  );

  return sorted.map((entry, index) => ({
    participantId: entry.participantId,
    nickname: entry.nickname,
    roundCount: entry.roundCount,
    baseScore: entry.baseScore,
    finalScore: entry.finalScore,
    pvi: entry.pvi,
    pviMultiplier: entry.pviMultiplier,
    pviClassification: entry.pviClassification,
    pviVerdict: entry.pviVerdict,
    isOnline: entry.isOnline,
    isSelf: entry.participantId === selfParticipantId,
    rank: index + 1,
  }));
}

export function rosterEntriesForScrollList(
  roster: ParticipantRosterEntry[]
): ParticipantRosterEntry[] {
  return roster.filter((entry) => !entry.isSelf);
}
