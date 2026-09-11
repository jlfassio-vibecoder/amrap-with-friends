import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type {
  InvitationDeliveryStatus,
  InvitationType,
} from '@/lib/invitations/invitationPresentation';
import { persistMissionIdentity } from '@/lib/missionIdentity';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

export type InvitationApiError = { message: string };

export interface InvitationMissionInfo {
  id: string;
  state: LiveMissionPhase | 'unknown';
  scheduledAt: string | null;
  durationMinutes: number;
  alreadyJoined: boolean;
  joinable: boolean;
}

export interface InvitationCampaignInfo {
  id: string;
  name: string;
  weekCount: number;
  missionsPerWeek: number;
  startDate: string;
  status: string;
  hostNickname: string | null;
  alreadyMember: boolean;
  joinable: boolean;
  memberCount: number;
}

export interface InvitationCardData {
  invitationId: string;
  deliveryId: string | null;
  type: InvitationType;
  status: InvitationDeliveryStatus | null;
  readAt: string | null;
  createdAt: string;
  note: string | null;
  fromUserId: string;
  fromNickname: string;
  includeSquadInvite: boolean;
  durationMinutes: number | null;
  workout: WorkoutExercise[];
  templateId: string | null;
  intensityTier: number | null;
  assignedWorkoutId: string | null;
  squadRequestId: string | null;
  squadStatus: string | null;
  resultingMissionId: string | null;
  resultingCampaignId: string | null;
  sourceMissionId: string | null;
  sourceMessageId: string | null;
  mission: InvitationMissionInfo | null;
  campaign: InvitationCampaignInfo | null;
}

export interface InvitationAudienceMember {
  userId: string;
  nickname: string;
}

export interface InvitationMissionParticipant extends InvitationAudienceMember {
  participantId: string;
  isFriend: boolean;
  isSelf: boolean;
}

export interface InvitationAudienceCampaign {
  campaignId: string;
  name: string;
  weekCount: number;
  missionsPerWeek: number;
  startDate: string;
  isHost: boolean;
}

export interface InvitationAudience {
  squad: InvitationAudienceMember[];
  missionParticipants: InvitationMissionParticipant[];
  campaigns: InvitationAudienceCampaign[];
}

export interface CreateInvitationInput {
  type: InvitationType;
  recipientUserIds?: string[];
  includeAllMissionParticipants?: boolean;
  postInChat?: boolean;
  includeSquadInvite?: boolean;
  note?: string | null;
  targetMissionId?: string | null;
  targetCampaignId?: string | null;
  sourceMissionId?: string | null;
  durationMinutes?: number | null;
  workout?: WorkoutExercise[] | null;
  templateId?: string | null;
  intensityTier?: number | null;
  clientRequestId?: string;
}

export interface CreateInvitationResult {
  invitationId: string;
  deliveryCount: number;
  skipped: number;
  replayed: boolean;
  sourceMessageId: string | null;
}

export interface AcceptInvitationResult {
  type: InvitationType;
  missionId?: string | null;
  campaignId?: string | null;
  hostToken?: string | null;
  participantId?: string | null;
  claimToken?: string | null;
  recovered?: boolean;
  alreadyMember?: boolean;
}

const ERROR_COPY: Record<string, string> = {
  'Authentication required': 'Sign in to send an invitation.',
  'Intake required': 'Complete your profile before sending an invitation.',
  'Pick what to send': 'Pick what to send.',
  'Pick someone to send it to': 'Pick someone to send it to.',
  'Pick a squad friend to send it to': 'Pick someone from your squad, or someone in this mission.',
  'They have not picked up your last few invitations yet':
    'They have not picked up your last few invitations yet. Give them a chance to catch up.',
  'They have not picked up your last few workouts yet':
    'They have not picked up your last few invitations yet. Give them a chance to catch up.',
  'They have blocked invitations from you': 'They are not receiving invitations from you.',
  'That invitation is not available': 'That invitation is no longer available.',
  'That mission is not available': 'That mission is no longer available.',
  'That campaign is not available': 'That campaign is no longer available.',
  'Campaign closed': 'This campaign has already finished.',
  'Campaign full': 'This campaign is full.',
  'Keep the note to 200 characters or fewer': 'Keep the note to 200 characters or fewer.',
  'Post in chat needs this mission': 'Post in chat is only available from a mission.',
  'Invite not found': 'That squad invite is not available.',
  'Invite declined recently': 'They declined recently. Give it a few days before asking again.',
  'Invite blocked': 'They have declined your invites, so you cannot send another.',
  'Already friends': "You are already on each other's squad.",
  'Squad full': 'That squad is full.',
  'Host mission limit reached': 'You already have 3 active missions.',
  'Slow down — wait a moment before sending again':
    'Slow down — wait a moment before sending again.',
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

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readPhase(value: unknown): LiveMissionPhase | 'unknown' {
  if (value === 'waiting' || value === 'setup' || value === 'work' || value === 'finished') {
    return value;
  }
  return 'unknown';
}

function readType(value: unknown): InvitationType | null {
  if (value === 'mission' || value === 'workout' || value === 'campaign') {
    return value;
  }
  return null;
}

function readStatus(value: unknown): InvitationDeliveryStatus | null {
  if (
    value === 'pending' ||
    value === 'accepted' ||
    value === 'dismissed' ||
    value === 'unavailable'
  ) {
    return value;
  }
  return null;
}

export function parseInvitationCard(raw: unknown): InvitationCardData | null {
  const row = readRecord(raw);
  const invitationId = readString(row.invitation_id);
  const type = readType(row.type);
  const fromUserId = readString(row.from_user_id);
  if (!invitationId || !type || !fromUserId) {
    return null;
  }
  const missionRaw =
    row.mission && typeof row.mission === 'object' ? readRecord(row.mission) : null;
  const campaignRaw =
    row.campaign && typeof row.campaign === 'object' ? readRecord(row.campaign) : null;
  return {
    invitationId,
    deliveryId: readString(row.delivery_id),
    type,
    status: readStatus(row.status),
    readAt: readString(row.read_at),
    createdAt: readString(row.created_at) ?? '',
    note: readString(row.note),
    fromUserId,
    fromNickname: readString(row.from_nickname) ?? 'A squad friend',
    includeSquadInvite: row.include_squad_invite === true,
    durationMinutes: readNumber(row.duration_minutes),
    workout: Array.isArray(row.workout) ? (row.workout as WorkoutExercise[]) : [],
    templateId: readString(row.template_id),
    intensityTier: readNumber(row.intensity_tier),
    assignedWorkoutId: readString(row.assigned_workout_id),
    squadRequestId: readString(row.squad_request_id),
    squadStatus: readString(row.squad_status),
    resultingMissionId: readString(row.resulting_mission_id),
    resultingCampaignId: readString(row.resulting_campaign_id),
    sourceMissionId: readString(row.source_mission_id),
    sourceMessageId: readString(row.source_message_id),
    mission: missionRaw
      ? {
          id: readString(missionRaw.id) ?? '',
          state: readPhase(missionRaw.state),
          scheduledAt: readString(missionRaw.scheduled_at),
          durationMinutes: readNumber(missionRaw.duration_minutes) ?? 0,
          alreadyJoined: missionRaw.already_joined === true,
          joinable: missionRaw.joinable === true,
        }
      : null,
    campaign: campaignRaw
      ? {
          id: readString(campaignRaw.id) ?? '',
          name: readString(campaignRaw.name) ?? 'Campaign',
          weekCount: readNumber(campaignRaw.week_count) ?? 0,
          missionsPerWeek: readNumber(campaignRaw.missions_per_week) ?? 0,
          startDate: readString(campaignRaw.start_date) ?? '',
          status: readString(campaignRaw.status) ?? '',
          hostNickname: readString(campaignRaw.host_nickname),
          alreadyMember: campaignRaw.already_member === true,
          joinable: campaignRaw.joinable === true,
          memberCount: readNumber(campaignRaw.member_count) ?? 0,
        }
      : null,
  };
}

export async function fetchMyInvitations(): Promise<{
  pending: InvitationCardData[];
  resolved: InvitationCardData[];
  unreadCount: number;
  error: InvitationApiError | null;
}> {
  const { data, error } = await callRpc('my_invitations');
  if (error) {
    return {
      pending: [],
      resolved: [],
      unreadCount: 0,
      error: { message: mapError(error.message) },
    };
  }
  const root = readRecord(data);
  const pending = Array.isArray(root.invitations) ? root.invitations : [];
  const resolved = Array.isArray(root.resolved) ? root.resolved : [];
  return {
    pending: pending
      .map(parseInvitationCard)
      .filter((row): row is InvitationCardData => row !== null),
    resolved: resolved
      .map(parseInvitationCard)
      .filter((row): row is InvitationCardData => row !== null),
    unreadCount: readNumber(root.unread_count) ?? 0,
    error: null,
  };
}

export async function fetchInvitationUnreadCount(): Promise<{
  unreadCount: number;
  error: InvitationApiError | null;
}> {
  const { data, error } = await callRpc('my_invitation_unread_count');
  if (error) {
    return { unreadCount: 0, error: { message: mapError(error.message) } };
  }
  return { unreadCount: readNumber(readRecord(data).unread_count) ?? 0, error: null };
}

export async function markInvitationsRead(
  deliveryIds?: string[]
): Promise<{ error: InvitationApiError | null }> {
  const { error } = await callRpc('mark_invitations_read', {
    p_delivery_ids: deliveryIds ?? null,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function dismissInvitation(
  deliveryId: string
): Promise<{ error: InvitationApiError | null }> {
  const { error } = await callRpc('dismiss_invitation', { p_delivery_id: deliveryId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function blockInvitationSender(
  fromUserId: string
): Promise<{ error: InvitationApiError | null }> {
  const { error } = await callRpc('block_invitation_sender', { p_from_user_id: fromUserId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function fetchInvitationAudience(
  sourceMissionId?: string | null
): Promise<{ data: InvitationAudience | null; error: InvitationApiError | null }> {
  const { data, error } = await callRpc('invitation_audience', {
    p_source_mission_id: sourceMissionId ?? null,
  });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }
  const root = readRecord(data);
  const squad = Array.isArray(root.squad) ? root.squad : [];
  const participants = Array.isArray(root.mission_participants) ? root.mission_participants : [];
  const campaigns = Array.isArray(root.campaigns) ? root.campaigns : [];
  return {
    data: {
      squad: squad
        .map((row) => {
          const rec = readRecord(row);
          const userId = readString(rec.user_id);
          if (!userId) {
            return null;
          }
          return { userId, nickname: readString(rec.nickname) ?? 'Athlete' };
        })
        .filter((row): row is InvitationAudienceMember => row !== null),
      missionParticipants: participants
        .map((row) => {
          const rec = readRecord(row);
          const userId = readString(rec.user_id);
          const participantId = readString(rec.participant_id);
          if (!userId || !participantId) {
            return null;
          }
          return {
            userId,
            participantId,
            nickname: readString(rec.nickname) ?? 'Athlete',
            isFriend: rec.is_friend === true,
            isSelf: rec.is_self === true,
          };
        })
        .filter((row): row is InvitationMissionParticipant => row !== null),
      campaigns: campaigns
        .map((row) => {
          const rec = readRecord(row);
          const campaignId = readString(rec.campaign_id);
          const name = readString(rec.name);
          if (!campaignId || !name) {
            return null;
          }
          return {
            campaignId,
            name,
            weekCount: readNumber(rec.week_count) ?? 0,
            missionsPerWeek: readNumber(rec.missions_per_week) ?? 0,
            startDate: readString(rec.start_date) ?? '',
            isHost: rec.is_host === true,
          };
        })
        .filter((row): row is InvitationAudienceCampaign => row !== null),
    },
    error: null,
  };
}

export async function fetchInvitationPreview(input: {
  invitationId: string;
  sourceMissionId?: string | null;
  participantId?: string | null;
  claimToken?: string | null;
}): Promise<{ data: InvitationCardData | null; error: InvitationApiError | null }> {
  const { data, error } = await callRpc('get_invitation_preview', {
    p_invitation_id: input.invitationId,
    p_source_mission_id: input.sourceMissionId ?? null,
    p_participant_id: input.participantId ?? null,
    p_claim_token: input.claimToken ?? null,
  });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }
  const card = parseInvitationCard(readRecord(data).invitation);
  if (!card) {
    return { data: null, error: { message: 'That invitation is no longer available.' } };
  }
  return { data: card, error: null };
}

export async function createInvitation(
  input: CreateInvitationInput
): Promise<{ data: CreateInvitationResult | null; error: InvitationApiError | null }> {
  const { data, error } = await callRpc('create_invitation', {
    p_type: input.type,
    p_recipient_user_ids: input.recipientUserIds ?? [],
    p_include_all_mission_participants: input.includeAllMissionParticipants ?? false,
    p_post_in_chat: input.postInChat ?? false,
    p_include_squad_invite: input.includeSquadInvite ?? false,
    p_note: input.note?.trim() || null,
    p_target_mission_id: input.targetMissionId ?? null,
    p_target_campaign_id: input.targetCampaignId ?? null,
    p_source_mission_id: input.sourceMissionId ?? null,
    p_duration_minutes: input.durationMinutes ?? null,
    p_workout: input.workout ?? null,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
    p_client_request_id: input.clientRequestId ?? crypto.randomUUID(),
  });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }
  const root = readRecord(data);
  const invitationId = readString(root.invitation_id);
  if (!invitationId) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  return {
    data: {
      invitationId,
      deliveryCount: readNumber(root.delivery_count) ?? 0,
      skipped: readNumber(root.skipped) ?? 0,
      replayed: root.replayed === true,
      sourceMessageId: readString(root.source_message_id),
    },
    error: null,
  };
}

export async function acceptInvitation(
  deliveryId: string,
  nickname?: string | null
): Promise<{ data: AcceptInvitationResult | null; error: InvitationApiError | null }> {
  const { data, error } = await callRpc('accept_invitation', {
    p_delivery_id: deliveryId,
    p_nickname: nickname?.trim() || null,
  });
  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }
  const root = readRecord(data);
  const type = readType(root.type);
  if (!type) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  const missionId = readString(root.mission_id);
  const hostToken = readString(root.host_token);
  const participantId = readString(root.participant_id);
  const claimToken = readString(root.claim_token);
  if (type === 'workout' && missionId && participantId) {
    persistMissionIdentity(missionId, {
      nickname: nickname?.trim() || 'Athlete',
      participantId,
      ...(hostToken ? { hostToken } : {}),
      ...(claimToken ? { claimToken } : {}),
    });
  }
  if (type === 'mission' && missionId && participantId) {
    persistMissionIdentity(missionId, {
      nickname: readString(root.nickname) || nickname?.trim() || 'Athlete',
      participantId,
      ...(hostToken ? { hostToken } : {}),
      ...(claimToken ? { claimToken } : {}),
    });
  }
  return {
    data: {
      type,
      missionId,
      campaignId: readString(root.campaign_id),
      hostToken,
      participantId,
      claimToken,
      recovered: root.recovered === true,
      alreadyMember: root.already_member === true,
    },
    error: null,
  };
}

export async function acceptInvitationSquad(
  deliveryId: string
): Promise<{ error: InvitationApiError | null }> {
  const { error } = await callRpc('accept_invitation_squad', { p_delivery_id: deliveryId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export async function saveChatInvitation(invitationId: string): Promise<{
  error: InvitationApiError | null;
  already?: boolean;
  deliveryId?: string | null;
}> {
  const { data, error } = await callRpc('save_chat_invitation', { p_invitation_id: invitationId });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  const root = readRecord(data);
  return {
    error: null,
    already: root.already === true,
    deliveryId: readString(root.delivery_id),
  };
}

export async function setCampaignMembersCanInvite(
  campaignId: string,
  enabled: boolean
): Promise<{ error: InvitationApiError | null }> {
  const { error } = await callRpc('set_campaign_members_can_invite', {
    p_campaign_id: campaignId,
    p_enabled: enabled,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

export function parseMessageAttachment(
  raw: unknown
): { type: 'invitation'; invitationId: string } | null {
  const rec = readRecord(raw);
  if (rec.type !== 'invitation') {
    return null;
  }
  const invitationId = readString(rec.invitation_id);
  if (!invitationId) {
    return null;
  }
  return { type: 'invitation', invitationId };
}
