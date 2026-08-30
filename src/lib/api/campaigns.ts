import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import {
  computeCampaignStandings,
  type CampaignStandingRow,
  type CampaignStandingsMember,
  type CampaignStandingsOccurrence,
  type CampaignStandingsScore,
  type CampaignWeekCount,
  type PlannedCampaignOccurrence,
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
  'Campaign closed': 'This campaign has already finished.',
  'Campaign full': 'This campaign is full.',
  'Host cannot leave': 'You are running this campaign, so you cannot leave it.',
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

export interface CampaignInvitePreview {
  name: string;
  goal: string | null;
  weekCount: number;
  sessionsPerWeek: number;
  status: CampaignStatus;
  hostNickname: string | null;
  memberCount: number;
  memberLimit: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

export interface JoinCampaignResult {
  campaignId: string;
  name: string;
  /** True when the athlete was already on the roster — a repeat click, not an error. */
  alreadyMember: boolean;
}

/**
 * Readable without an account: the invite code is the secret, so someone
 * following a link can see what they are being asked to commit to before
 * they sign up. Deliberately excludes the roster and the calendar.
 */
export async function fetchCampaignInvitePreview(
  inviteCode: string
): Promise<{ data: CampaignInvitePreview | null; error: CampaignApiError | null }> {
  const code = inviteCode.trim();
  if (!code) {
    return { data: null, error: { message: 'That invite link is not valid.' } };
  }

  const { data, error } = await callRpc('campaign_invite_preview', {
    p_invite_code: code,
  });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const row = readRecord(data);
  const name = readString(row.name);
  if (!name) {
    return { data: null, error: { message: 'That campaign is not available.' } };
  }

  return {
    data: {
      name,
      goal: readString(row.goal),
      weekCount: readNumber(row.week_count),
      sessionsPerWeek: readNumber(row.sessions_per_week),
      status: (readString(row.status) ?? 'active') as CampaignStatus,
      hostNickname: readString(row.host_nickname),
      memberCount: readNumber(row.member_count),
      memberLimit: readNumber(row.member_limit),
      firstSessionDate: readString(row.first_session_date),
      lastSessionDate: readString(row.last_session_date),
    },
    error: null,
  };
}

export async function joinCampaign(
  inviteCode: string
): Promise<{ data: JoinCampaignResult | null; error: CampaignApiError | null }> {
  const code = inviteCode.trim();
  if (!code) {
    return { data: null, error: { message: 'That invite link is not valid.' } };
  }

  const { data, error } = await callRpc('join_campaign', { p_invite_code: code });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const row = readRecord(data);
  const campaignId = readString(row.campaign_id);
  if (!campaignId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return {
    data: {
      campaignId,
      name: readString(row.name) ?? '',
      alreadyMember: row.already_member === true,
    },
    error: null,
  };
}

export async function leaveCampaign(
  campaignId: string
): Promise<{ error: CampaignApiError | null }> {
  const { error } = await callRpc('leave_campaign', { p_campaign_id: campaignId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export type { CampaignStandingRow, CampaignStandingsMember, CampaignStandingsScore };

export type CampaignStandingsPayload = {
  standings: CampaignStandingRow[];
  members: CampaignStandingsMember[];
  scores: CampaignStandingsScore[];
};

/**
 * Fetches the raw standings matrix from Postgres and ranks in TypeScript so
 * the aggregation rules stay unit-tested in one place. Also returns the matrix
 * so the detail page can compute benchmark → retest progress without a second RPC.
 */
export async function fetchCampaignStandings(
  campaignId: string
): Promise<{ data: CampaignStandingsPayload; error: CampaignApiError | null }> {
  const empty: CampaignStandingsPayload = { standings: [], members: [], scores: [] };
  const { data, error } = await callRpc('campaign_standings', {
    p_campaign_id: campaignId,
  });
  if (error) {
    return { data: empty, error: { message: mapError(error.message) } };
  }

  const root = readRecord(data);
  const membersRaw = Array.isArray(root.members) ? root.members : [];
  const occurrencesRaw = Array.isArray(root.occurrences) ? root.occurrences : [];
  const scoresRaw = Array.isArray(root.scores) ? root.scores : [];

  const members = membersRaw
    .map((raw) => {
      const row = readRecord(raw);
      const userId = readString(row.user_id);
      const joinedLocalDate = readString(row.joined_local_date);
      if (!userId || !joinedLocalDate) {
        return null;
      }
      return {
        userId,
        nickname: readString(row.nickname),
        joinedLocalDate,
        left: readString(row.status) === 'left',
      };
    })
    .filter((entry): entry is CampaignStandingsMember => entry !== null);

  const occurrences = occurrencesRaw
    .map((raw): CampaignStandingsOccurrence | null => {
      const row = readRecord(raw);
      const occurrenceId = readString(row.occurrence_id);
      const localDate = readString(row.local_date);
      const status = readString(row.status);
      if (!occurrenceId || !localDate || !status) {
        return null;
      }
      if (
        status !== 'planned' &&
        status !== 'generated' &&
        status !== 'done' &&
        status !== 'skipped'
      ) {
        return null;
      }
      return { occurrenceId, localDate, status };
    })
    .filter((entry): entry is CampaignStandingsOccurrence => entry !== null);

  const scores = scoresRaw
    .map((raw) => {
      const row = readRecord(raw);
      const occurrenceId = readString(row.occurrence_id);
      const userId = readString(row.user_id);
      if (!occurrenceId || !userId) {
        return null;
      }
      const finalScore =
        row.final_score === null || row.final_score === undefined
          ? null
          : readNumber(row.final_score);
      return { occurrenceId, userId, finalScore };
    })
    .filter((entry): entry is CampaignStandingsScore => entry !== null);

  return {
    data: {
      standings: computeCampaignStandings({ members, occurrences, scores }),
      members,
      scores,
    },
    error: null,
  };
}
