import type {
  LeaderboardEntry,
  SessionPresenceEntry,
} from '@/lib/sessionSync/types';

export interface ParticipantRosterEntry {
  participantId: string;
  nickname: string;
  roundCount: number;
  baseScore: number;
  isOnline: boolean;
  isSelf: boolean;
  rank: number;
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

export function buildParticipantRoster(
  leaderboard: LeaderboardEntry[],
  presence: SessionPresenceEntry[],
  selfParticipantId: string
): ParticipantRosterEntry[] {
  const byId = new Map<
    string,
    {
      participantId: string;
      nickname: string;
      roundCount: number;
      baseScore: number;
      isOnline: boolean;
    }
  >();

  for (const entry of leaderboard) {
    byId.set(entry.participantId, {
      participantId: entry.participantId,
      nickname: entry.nickname,
      roundCount: entry.roundCount,
      baseScore: entry.baseScore,
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
      isOnline: entry.isOnline,
    });
  }

  const sorted = [...byId.values()].sort((a, b) => {
    if (b.baseScore !== a.baseScore) {
      return b.baseScore - a.baseScore;
    }

    return a.nickname.localeCompare(b.nickname);
  });

  return sorted.map((entry, index) => ({
    participantId: entry.participantId,
    nickname: entry.nickname,
    roundCount: entry.roundCount,
    baseScore: entry.baseScore,
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
