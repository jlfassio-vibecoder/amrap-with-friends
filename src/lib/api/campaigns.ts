import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import type {
  CampaignWeekCount,
  PlannedCampaignOccurrence,
} from '@/lib/campaign';

export type CampaignApiError = { message: string };

export type CampaignStatus = 'draft' | 'active' | 'complete' | 'abandoned';
export type CampaignRole = 'host' | 'member';
export type CampaignOccurrenceStatus = 'planned' | 'generated' | 'done' | 'skipped';

export interface CampaignSummary {
  campaignId: string;
  name: string;
  goal: string | null;
  weekCount: number;
  sessionsPerWeek: number;
  startDate: string;
  timezone: string;
  status: CampaignStatus;
  role: CampaignRole;
  /** Host-only: null for members, so they cannot re-share the campaign. */
  inviteCode: string | null;
  totalSessions: number;
  completedSessions: number;
  memberCount: number;
}

export interface CampaignOccurrenceEntry {
  occurrenceId: string;
  sequence: number;
  weekNumber: number;
  slotNumber: number;
  localDate: string;
  localTime: string;
  templateId: string | null;
  durationMinutes: number;
  intensityTier: number | null;
  workout: WorkoutExercise[];
  sessionId: string | null;
  status: CampaignOccurrenceStatus;
}

export interface CampaignMemberEntry {
  userId: string;
  role: CampaignRole;
  nickname: string | null;
  joinedAt: string;
}

export interface CampaignDetail {
  campaignId: string;
  name: string;
  goal: string | null;
  weekCount: number;
  sessionsPerWeek: number;
  startDate: string;
  timezone: string;
  status: CampaignStatus;
  viewerRole: CampaignRole;
  inviteCode: string | null;
  occurrences: CampaignOccurrenceEntry[];
  members: CampaignMemberEntry[];
}

export interface CreateCampaignInput {
  name: string;
  goal?: string | null;
  weekCount: CampaignWeekCount;
  startDate: string;
  occurrences: PlannedCampaignOccurrence[];
}

export interface CreateCampaignResult {
  campaignId: string;
  inviteCode: string;
  totalSessions: number;
  sessionsPerWeek: number;
}

const ERROR_COPY: Record<string, string> = {
  'Authentication required': 'Sign in to manage campaigns.',
  'Intake required': 'Complete your profile before starting a campaign.',
  'Campaign limit reached': 'You already have three campaigns running. Finish one first.',
  'Campaign not found': 'That campaign is not available.',
  invalid_timezone: 'We could not read your timezone. Try again from this device.',
};

function mapError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  for (const [needle, copy] of Object.entries(ERROR_COPY)) {
    if (message.includes(needle)) {
      return copy;
    }
  }
  return message;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Postgres returns `time` as 'HH:MM:SS'; the UI only ever shows 'HH:MM'. */
function readLocalTime(value: unknown): string {
  const raw = readString(value) ?? '';
  return raw.slice(0, 5);
}

function parseSummary(raw: unknown): CampaignSummary | null {
  const row = readRecord(raw);
  const campaignId = readString(row.campaign_id);
  const name = readString(row.name);
  if (!campaignId || !name) {
    return null;
  }
  return {
    campaignId,
    name,
    goal: readString(row.goal),
    weekCount: readNumber(row.week_count),
    sessionsPerWeek: readNumber(row.sessions_per_week),
    startDate: readString(row.start_date) ?? '',
    timezone: readString(row.timezone) ?? '',
    status: (readString(row.status) ?? 'active') as CampaignStatus,
    role: (readString(row.role) ?? 'member') as CampaignRole,
    inviteCode: readString(row.invite_code),
    totalSessions: readNumber(row.total_sessions),
    completedSessions: readNumber(row.completed_sessions),
    memberCount: readNumber(row.member_count),
  };
}

function parseOccurrence(raw: unknown): CampaignOccurrenceEntry | null {
  const row = readRecord(raw);
  const occurrenceId = readString(row.occurrence_id);
  if (!occurrenceId) {
    return null;
  }
  return {
    occurrenceId,
    sequence: readNumber(row.sequence),
    weekNumber: readNumber(row.week_number),
    slotNumber: readNumber(row.slot_number),
    localDate: readString(row.local_date) ?? '',
    localTime: readLocalTime(row.local_time),
    templateId: readString(row.template_id),
    durationMinutes: readNumber(row.duration_minutes),
    intensityTier: row.intensity_tier === null ? null : readNumber(row.intensity_tier),
    workout: Array.isArray(row.workout) ? (row.workout as WorkoutExercise[]) : [],
    sessionId: readString(row.session_id),
    status: (readString(row.status) ?? 'planned') as CampaignOccurrenceStatus,
  };
}

function parseMember(raw: unknown): CampaignMemberEntry | null {
  const row = readRecord(raw);
  const userId = readString(row.user_id);
  if (!userId) {
    return null;
  }
  return {
    userId,
    role: (readString(row.role) ?? 'member') as CampaignRole,
    nickname: readString(row.nickname),
    joinedAt: readString(row.joined_at) ?? '',
  };
}

/**
 * The client builds the calendar (see `@/lib/campaign`) and sends it whole.
 * The workout library lives here, not in Postgres, so each occurrence carries
 * its own resolved workout — the generator copies it rather than looking it up.
 */
export async function createCampaign(
  input: CreateCampaignInput
): Promise<{ data: CreateCampaignResult | null; error: CampaignApiError | null }> {
  const name = input.name.trim();
  if (!name) {
    return { data: null, error: { message: 'Name your campaign.' } };
  }
  if (input.occurrences.length === 0) {
    return { data: null, error: { message: 'Build the campaign schedule first.' } };
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await callRpc('create_campaign', {
    p_name: name,
    p_goal: input.goal?.trim() || null,
    p_week_count: input.weekCount,
    p_start_date: input.startDate,
    p_timezone: timeZone,
    p_occurrences: input.occurrences.map((occurrence) => ({
      sequence: occurrence.sequence,
      week_number: occurrence.weekNumber,
      slot_number: occurrence.slotNumber,
      local_date: occurrence.localDate,
      local_time: occurrence.localTime,
      template_id: occurrence.templateId,
      duration_minutes: occurrence.durationMinutes,
      intensity_tier: occurrence.intensityTier,
      workout: occurrence.workout,
    })),
  });

  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const row = readRecord(data);
  const campaignId = readString(row.campaign_id);
  const inviteCode = readString(row.invite_code);
  if (!campaignId || !inviteCode) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return {
    data: {
      campaignId,
      inviteCode,
      totalSessions: readNumber(row.total_sessions),
      sessionsPerWeek: readNumber(row.sessions_per_week),
    },
    error: null,
  };
}

export async function fetchMyCampaigns(): Promise<{
  data: CampaignSummary[];
  error: CampaignApiError | null;
}> {
  const { data, error } = await callRpc('my_campaigns');
  if (error) {
    return { data: [], error: { message: mapError(error.message) } };
  }
  const rows = readRecord(data).campaigns;
  if (!Array.isArray(rows)) {
    return { data: [], error: null };
  }
  return {
    data: rows.map(parseSummary).filter((entry): entry is CampaignSummary => entry !== null),
    error: null,
  };
}

export async function fetchCampaignDetail(
  campaignId: string
): Promise<{ data: CampaignDetail | null; error: CampaignApiError | null }> {
  const { data, error } = await callRpc('campaign_detail', { p_campaign_id: campaignId });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const root = readRecord(data);
  const campaign = readRecord(root.campaign);
  const id = readString(campaign.campaign_id);
  const name = readString(campaign.name);
  if (!id || !name) {
    return { data: null, error: { message: 'That campaign is not available.' } };
  }

  const occurrences = Array.isArray(root.occurrences) ? root.occurrences : [];
  const members = Array.isArray(root.members) ? root.members : [];

  return {
    data: {
      campaignId: id,
      name,
      goal: readString(campaign.goal),
      weekCount: readNumber(campaign.week_count),
      sessionsPerWeek: readNumber(campaign.sessions_per_week),
      startDate: readString(campaign.start_date) ?? '',
      timezone: readString(campaign.timezone) ?? '',
      status: (readString(campaign.status) ?? 'active') as CampaignStatus,
      viewerRole: (readString(campaign.viewer_role) ?? 'member') as CampaignRole,
      inviteCode: readString(campaign.invite_code),
      occurrences: occurrences
        .map(parseOccurrence)
        .filter((entry): entry is CampaignOccurrenceEntry => entry !== null),
      members: members
        .map(parseMember)
        .filter((entry): entry is CampaignMemberEntry => entry !== null),
    },
    error: null,
  };
}
