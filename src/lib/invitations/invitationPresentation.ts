import type { LiveMissionPhase } from '@/lib/missionSync/types';

export type InvitationType = 'mission' | 'workout' | 'campaign';

export type InvitationDeliveryStatus = 'pending' | 'accepted' | 'dismissed' | 'unavailable';

export type MissionInvitationAction =
  'view_mission' | 'join_mission' | 'return_mission' | 'view_workout' | 'unavailable';

export function formatDurationLabel(durationMinutes: number): string {
  return `${durationMinutes}-min`;
}

export function formatCampaignLengthLabel(weekCount: number): string {
  return `${weekCount}-week`;
}

/** "15-minute mission" / "8-week campaign" for titles and notes. */
export function formatMissionNoun(durationMinutes: number): string {
  return `${durationMinutes}-minute mission`;
}

export function formatCampaignNoun(weekCount: number): string {
  return `${weekCount}-week campaign`;
}

export function invitationHeadline(input: {
  senderName: string;
  type: InvitationType;
  durationMinutes: number | null;
  campaignWeekCount: number | null;
  includeSquadInvite: boolean;
}): string {
  const sender = input.senderName.trim() || 'A squad friend';
  if (input.includeSquadInvite) {
    if (input.type === 'campaign' && input.campaignWeekCount) {
      return `${sender} invited you to their squad and sent you a ${formatCampaignNoun(input.campaignWeekCount)}`;
    }
    const duration = input.durationMinutes ?? 15;
    return `${sender} invited you to their squad and sent you a ${duration}-minute workout`;
  }
  if (input.type === 'campaign' && input.campaignWeekCount) {
    return `${sender} shared a ${formatCampaignNoun(input.campaignWeekCount)}`;
  }
  if (input.type === 'workout') {
    return `${sender} shared a ${input.durationMinutes ?? 15}-minute workout`;
  }
  return `${sender} shared a ${formatMissionNoun(input.durationMinutes ?? 15)}`;
}

/**
 * Join is only open while the mission is waiting. Setup/work lock new joiners
 * (existing late-join rule). Scheduled waiting missions still use View rather
 * than Join so the card does not read as "start now".
 */
export function missionInvitationAction(input: {
  state: LiveMissionPhase | 'unknown' | null;
  scheduledAt: string | null;
  alreadyJoined: boolean;
  nowMs?: number;
}): MissionInvitationAction {
  if (input.alreadyJoined) {
    if (input.state === 'finished') {
      return 'view_workout';
    }
    return 'return_mission';
  }
  if (input.state === 'finished') {
    return 'view_workout';
  }
  if (input.state === 'waiting') {
    const scheduledAt = input.scheduledAt;
    if (scheduledAt) {
      const when = Date.parse(scheduledAt);
      const now = input.nowMs ?? Date.now();
      if (Number.isFinite(when) && when > now) {
        return 'view_mission';
      }
    }
    return 'join_mission';
  }
  if (input.state === 'setup' || input.state === 'work') {
    return 'unavailable';
  }
  return 'unavailable';
}

export function missionInvitationCtaLabel(
  action: MissionInvitationAction,
  durationMinutes: number
): string {
  const dur = formatDurationLabel(durationMinutes);
  switch (action) {
    case 'view_mission':
      return `View ${dur} mission`;
    case 'join_mission':
      return `Join ${dur} mission`;
    case 'return_mission':
      return `Return to ${dur} mission`;
    case 'view_workout':
      return 'View workout';
    case 'unavailable':
      return 'Joining closed';
  }
}

export function workoutInvitationCtaLabel(durationMinutes: number): string {
  return `Start ${formatDurationLabel(durationMinutes)} mission`;
}

export function campaignViewCtaLabel(weekCount: number): string {
  return `View ${formatCampaignLengthLabel(weekCount)} campaign`;
}

export function campaignJoinCtaLabel(weekCount: number): string {
  return `Join ${formatCampaignLengthLabel(weekCount)} campaign`;
}

export function formatInvitationWhen(iso: string | null, now = new Date()): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  const sameYear = date.getFullYear() === now.getFullYear();
  const monthDay = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
  return `${weekday} · ${monthDay} · ${time} in your timezone`;
}

export function invitationAudienceSummary(input: {
  squadCount: number;
  missionCount: number;
  postInChat: boolean;
}): string {
  const parts: string[] = [];
  const total = input.squadCount + input.missionCount;
  if (total === 0 && !input.postInChat) {
    return 'Pick at least one recipient.';
  }
  if (total === 1) {
    parts.push('Sending to 1 person');
  } else if (total > 1) {
    parts.push(`Sending to ${total} people`);
  }
  const groups: string[] = [];
  if (input.squadCount > 0) {
    groups.push(`${input.squadCount} ${input.squadCount === 1 ? 'squad friend' : 'squad friends'}`);
  }
  if (input.missionCount > 0) {
    groups.push(
      `${input.missionCount} ${input.missionCount === 1 ? 'person' : 'people'} in this mission`
    );
  }
  if (groups.length > 0 && total > 0) {
    parts[0] = `${parts[0]} (${groups.join(', ')})`;
  }
  if (input.postInChat) {
    parts.push(total > 0 ? 'Will also post in chat' : 'Will post in chat');
  }
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}
