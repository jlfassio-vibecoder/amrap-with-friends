import { callRpc } from '@/lib/api/callRpc';
import { isLinkableAnonId } from '@/lib/api/linkAnonIdentity';
import { isGuestHistoryCohort, type ActivityCohortId } from '@/lib/coach/activityCohorts';
import type { HudOvertraining } from '@/lib/hud/types';

export type CoachApiError = { message: string };

export interface CoachTopStrip {
  missionsCreated7d: number;
  missionsCreated30d: number;
  missionsFinished7d: number;
  missionsFinished30d: number;
  guestBrowsers7d: number;
  uniqueAnonIds: number;
  registeredUsers: number;
  practiceMissionsStarted: number;
  liveMissionsCreated: number;
}

export interface CoachClaimFunnel {
  promptsShown: number;
  claimsCompleted: number;
  claimsConflicted: number;
  completionRatePct: number | null;
}

export interface CoachIntakeFunnel {
  submitted: number;
  abandoned: number;
  completionRatePct: number | null;
}

export interface CoachRallyConversion {
  linksCopied: number;
  deepLinkJoins: number;
  conversionRatePct: number | null;
}

export interface CoachMissionAbandonment {
  missionsFinished: number;
  missionsWithAbandonmentEvent: number;
  abandonmentRatePct: number | null;
}

export interface CoachTemplatePerformanceRow {
  templateId: string;
  intensityTier: number | null;
  durationMinutes: number;
  missionsCreated: number;
  missionsCompleted: number;
  completionRatePct: number | null;
}

export interface CoachHostVsJoinerRow {
  firstRole: string;
  userCount: number;
  avgMissionsPerUser: number | null;
  avgActiveDaysPerUser: number | null;
}

export interface CoachAudioUnlockRow {
  audioContextState: string;
  unlockCount: number;
  pctOfUnlocks: number | null;
}

export interface CoachRpcReliabilityRow {
  rpcName: string;
  callCount: number;
  errorCount: number;
  errorRatePct: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface CoachRealtimeReliabilityRow {
  status: string;
  eventCount: number;
  p50SubscribeLatencyMs: number | null;
}

export interface CoachDashboard {
  topStrip: CoachTopStrip;
  claimFunnel: CoachClaimFunnel;
  intakeFunnel: CoachIntakeFunnel;
  rallyConversion: CoachRallyConversion;
  missionAbandonment: CoachMissionAbandonment;
  templatePerformance: CoachTemplatePerformanceRow[];
  hostVsJoinerRetention: CoachHostVsJoinerRow[];
  audioUnlockRate: CoachAudioUnlockRow[];
  rpcReliability: CoachRpcReliabilityRow[];
  realtimeReliability: CoachRealtimeReliabilityRow[];
}

export interface CoachEventRow {
  id: string;
  eventName: string;
  occurredAt: string;
  missionId: string | null;
  participantId: string | null;
  userId: string | null;
  anonId: string | null;
  route: string | null;
  props: Record<string, unknown>;
}

export interface CoachAnonSummary {
  lastOccurredAt: string | null;
  lastRoute: string | null;
  eventCount: number;
  eventNameCounts: Record<string, number>;
  linkedUserId: string | null;
  linkedNickname: string | null;
}

export interface CoachUserListRow {
  userId: string;
  username: string;
  nickname: string;
  email: string;
  perceivedClassification: string;
  accountCreatedAt: string;
  lastActiveAt: string | null;
  totalMissions: number;
}

export interface CoachGuestListRow {
  anonId: string;
  lastOccurredAt: string;
}

export type CoachOnboardingStuckStatus = 'needs_profile' | 'intake_incomplete';

export interface CoachOnboardingStuckRow {
  userId: string;
  email: string;
  status: CoachOnboardingStuckStatus;
  accountCreatedAt: string;
  lastSignInAt: string | null;
  providers: string[];
}

export function coachOnboardingStuckStatusLabel(status: CoachOnboardingStuckStatus): string {
  switch (status) {
    case 'needs_profile':
      return 'Signed up — profile not started';
    case 'intake_incomplete':
      return 'Profile started — finish your details';
  }
}

export interface CoachUserProfile {
  userId: string;
  username: string;
  nickname: string;
  email: string;
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  biologicalSex: string | null;
  perceivedClassification: string;
  accountCreatedAt: string;
}

export interface CoachUserClassificationEvent {
  kind: string;
  previousValue: string | null;
  newValue: string;
  occurredAt: string;
}

export interface CoachUserMissionRow {
  missionId: string;
  role: string;
  templateId: string | null;
  intensityTier: number | null;
  durationMinutes: number;
  state: string;
  finalScore: number | null;
  createdAt: string;
  joinedAt: string;
}

export interface CoachUserSummary {
  missionsAsHost: number;
  missionsAsJoiner: number;
  totalMissions: number;
  practiceMissionsStarted: number;
  firstSeenAt: string | null;
  lastActiveAt: string | null;
}

export interface CoachUserDetail {
  profile: CoachUserProfile;
  classificationHistory: CoachUserClassificationEvent[];
  missions: CoachUserMissionRow[];
  summary: CoachUserSummary;
  overtraining: HudOvertraining;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function num(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeNum(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function strOrNull(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function mapCoachError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Not authorized')) {
    return 'Not authorized.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to view the coach dashboard.';
  }
  return message;
}

function parseTopStrip(row: Record<string, unknown>): CoachTopStrip {
  return {
    missionsCreated7d: num(row, 'missionsCreated7d'),
    missionsCreated30d: num(row, 'missionsCreated30d'),
    missionsFinished7d: num(row, 'missionsFinished7d'),
    missionsFinished30d: num(row, 'missionsFinished30d'),
    guestBrowsers7d: num(row, 'guestBrowsers7d'),
    uniqueAnonIds: num(row, 'uniqueAnonIds'),
    registeredUsers: num(row, 'registeredUsers'),
    practiceMissionsStarted: num(row, 'practiceMissionsStarted'),
    liveMissionsCreated: num(row, 'liveMissionsCreated'),
  };
}

function parseClaimFunnel(row: Record<string, unknown>): CoachClaimFunnel {
  return {
    promptsShown: num(row, 'prompts_shown'),
    claimsCompleted: num(row, 'claims_completed'),
    claimsConflicted: num(row, 'claims_conflicted'),
    completionRatePct: numOrNull(row, 'completion_rate_pct'),
  };
}

function parseIntakeFunnel(row: Record<string, unknown>): CoachIntakeFunnel {
  return {
    submitted: num(row, 'submitted'),
    abandoned: num(row, 'abandoned'),
    completionRatePct: numOrNull(row, 'completion_rate_pct'),
  };
}

function parseRallyConversion(row: Record<string, unknown>): CoachRallyConversion {
  return {
    linksCopied: num(row, 'links_copied'),
    deepLinkJoins: num(row, 'deep_link_joins'),
    conversionRatePct: numOrNull(row, 'conversion_rate_pct'),
  };
}

function parseMissionAbandonment(row: Record<string, unknown>): CoachMissionAbandonment {
  return {
    missionsFinished: num(row, 'missions_finished'),
    missionsWithAbandonmentEvent: num(row, 'missions_with_abandonment_event'),
    abandonmentRatePct: numOrNull(row, 'abandonment_rate_pct'),
  };
}

function parseTemplateRow(row: Record<string, unknown>): CoachTemplatePerformanceRow {
  return {
    templateId: str(row, 'template_id'),
    intensityTier: numOrNull(row, 'intensity_tier'),
    durationMinutes: num(row, 'duration_minutes'),
    missionsCreated: num(row, 'missions_created'),
    missionsCompleted: num(row, 'missions_completed'),
    completionRatePct: numOrNull(row, 'completion_rate_pct'),
  };
}

function parseHostVsJoinerRow(row: Record<string, unknown>): CoachHostVsJoinerRow {
  return {
    firstRole: str(row, 'first_role'),
    userCount: num(row, 'user_count'),
    avgMissionsPerUser: numOrNull(row, 'avg_missions_per_user'),
    avgActiveDaysPerUser: numOrNull(row, 'avg_active_days_per_user'),
  };
}

function parseAudioUnlockRow(row: Record<string, unknown>): CoachAudioUnlockRow {
  return {
    audioContextState: str(row, 'audio_context_state'),
    unlockCount: num(row, 'unlock_count'),
    pctOfUnlocks: numOrNull(row, 'pct_of_unlocks'),
  };
}

function parseRpcReliabilityRow(row: Record<string, unknown>): CoachRpcReliabilityRow {
  return {
    rpcName: str(row, 'rpc_name'),
    callCount: num(row, 'call_count'),
    errorCount: num(row, 'error_count'),
    errorRatePct: numOrNull(row, 'error_rate_pct'),
    p50LatencyMs: numOrNull(row, 'p50_latency_ms'),
    p95LatencyMs: numOrNull(row, 'p95_latency_ms'),
  };
}

function parseRealtimeReliabilityRow(row: Record<string, unknown>): CoachRealtimeReliabilityRow {
  return {
    status: str(row, 'status'),
    eventCount: num(row, 'event_count'),
    p50SubscribeLatencyMs: numOrNull(row, 'p50_subscribe_latency_ms'),
  };
}

function parseEventNameCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const [name, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      counts[name] = count;
    }
  }
  return counts;
}

export function parseCoachAnonSummary(value: unknown): CoachAnonSummary | null {
  const raw = asRecord(value);
  if (raw.ok !== true) {
    return null;
  }
  return {
    lastOccurredAt: strOrNull(raw, 'lastOccurredAt'),
    lastRoute: strOrNull(raw, 'lastRoute'),
    eventCount: nonNegativeNum(raw, 'eventCount'),
    eventNameCounts: parseEventNameCounts(raw.eventNameCounts),
    linkedUserId: strOrNull(raw, 'linkedUserId'),
    linkedNickname: strOrNull(raw, 'linkedNickname'),
  };
}

function parseEventRow(row: Record<string, unknown>): CoachEventRow | null {
  const id = strOrNull(row, 'id');
  const eventName = strOrNull(row, 'event_name');
  const occurredAt = strOrNull(row, 'occurred_at');
  if (!id || !eventName || !occurredAt) {
    return null;
  }
  return {
    id,
    eventName,
    occurredAt,
    missionId: strOrNull(row, 'mission_id'),
    participantId: strOrNull(row, 'participant_id'),
    userId: strOrNull(row, 'user_id'),
    anonId: strOrNull(row, 'anon_id'),
    route: strOrNull(row, 'route'),
    props: asRecord(row.props),
  };
}

function parseUserListRow(row: Record<string, unknown>): CoachUserListRow | null {
  const userId = strOrNull(row, 'user_id');
  const username = strOrNull(row, 'username');
  const email = strOrNull(row, 'email');
  if (!userId || !username || !email) {
    return null;
  }
  return {
    userId,
    username,
    nickname: str(row, 'nickname'),
    email,
    perceivedClassification: str(row, 'perceived_classification'),
    accountCreatedAt: str(row, 'account_created_at'),
    lastActiveAt: strOrNull(row, 'last_active_at'),
    totalMissions: num(row, 'total_missions'),
  };
}

function parseGuestListRow(row: Record<string, unknown>): CoachGuestListRow | null {
  const anonId = strOrNull(row, 'anon_id');
  const lastOccurredAt = strOrNull(row, 'last_occurred_at');
  if (!anonId || !lastOccurredAt) {
    return null;
  }
  return { anonId, lastOccurredAt };
}

function parseOnboardingStuckStatus(value: unknown): CoachOnboardingStuckStatus | null {
  if (value === 'needs_profile' || value === 'intake_incomplete') {
    return value;
  }
  return null;
}

function parseProviders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function parseOnboardingStuckRow(row: Record<string, unknown>): CoachOnboardingStuckRow | null {
  const userId = strOrNull(row, 'user_id');
  const email = strOrNull(row, 'email');
  const status = parseOnboardingStuckStatus(row.status);
  const accountCreatedAt = strOrNull(row, 'account_created_at');
  if (!userId || !email || !status || !accountCreatedAt) {
    return null;
  }
  return {
    userId,
    email,
    status,
    accountCreatedAt,
    lastSignInAt: strOrNull(row, 'last_sign_in_at'),
    providers: parseProviders(row.providers),
  };
}

function parseUserProfile(row: Record<string, unknown>): CoachUserProfile | null {
  const userId = strOrNull(row, 'userId');
  const username = strOrNull(row, 'username');
  const email = strOrNull(row, 'email');
  const accountCreatedAt = strOrNull(row, 'accountCreatedAt');
  if (!userId || !username || !email || !accountCreatedAt) {
    return null;
  }
  return {
    userId,
    username,
    nickname: str(row, 'nickname'),
    email,
    heightCm: numOrNull(row, 'heightCm'),
    weightKg: numOrNull(row, 'weightKg'),
    birthYear: numOrNull(row, 'birthYear'),
    biologicalSex: strOrNull(row, 'biologicalSex'),
    perceivedClassification: str(row, 'perceivedClassification'),
    accountCreatedAt,
  };
}

function parseClassificationEvent(
  row: Record<string, unknown>
): CoachUserClassificationEvent | null {
  const newValue = strOrNull(row, 'new_value');
  const occurredAt = strOrNull(row, 'occurred_at');
  if (!newValue || !occurredAt) {
    return null;
  }
  return {
    kind: str(row, 'kind'),
    previousValue: strOrNull(row, 'previous_value'),
    newValue,
    occurredAt,
  };
}

function parseUserMissionRow(row: Record<string, unknown>): CoachUserMissionRow | null {
  const missionId = strOrNull(row, 'mission_id');
  const joinedAt = strOrNull(row, 'joined_at');
  const createdAt = strOrNull(row, 'created_at');
  if (!missionId || !joinedAt || !createdAt) {
    return null;
  }
  return {
    missionId,
    role: str(row, 'role'),
    templateId: strOrNull(row, 'template_id'),
    intensityTier: numOrNull(row, 'intensity_tier'),
    durationMinutes: num(row, 'duration_minutes'),
    state: str(row, 'state'),
    finalScore: numOrNull(row, 'final_score'),
    createdAt,
    joinedAt,
  };
}

function parseOvertraining(row: Record<string, unknown>): HudOvertraining {
  return {
    acuteLoad7d: nonNegativeNum(row, 'acuteLoad7d'),
    chronicWeeklyLoad28d: nonNegativeNum(row, 'chronicWeeklyLoad28d'),
    consecutiveHighIntensityDays: nonNegativeNum(row, 'consecutiveHighIntensityDays'),
  };
}

function parseUserSummary(row: Record<string, unknown>): CoachUserSummary {
  return {
    missionsAsHost: num(row, 'missionsAsHost'),
    missionsAsJoiner: num(row, 'missionsAsJoiner'),
    totalMissions: num(row, 'totalMissions'),
    practiceMissionsStarted: num(row, 'practiceMissionsStarted'),
    firstSeenAt: strOrNull(row, 'firstSeenAt'),
    lastActiveAt: strOrNull(row, 'lastActiveAt'),
  };
}

export async function fetchCoachUsersList(input: {
  search?: string | null;
  limit?: number;
  activityBucket?: string | null;
}): Promise<{ data: CoachUserListRow[] | null; error: CoachApiError | null }> {
  const { data, error } = await callRpc('coach_users_list', {
    p_search: input.search ?? null,
    p_limit: input.limit ?? 50,
    p_activity_bucket: input.activityBucket ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const users = asArray(raw.users)
    .map(parseUserListRow)
    .filter((row): row is CoachUserListRow => row !== null);

  return { data: users, error: null };
}

export async function fetchCoachGuestList(input: {
  activityBucket: string;
  limit?: number;
}): Promise<{ data: CoachGuestListRow[] | null; error: CoachApiError | null }> {
  if (!isGuestHistoryCohort(input.activityBucket as ActivityCohortId)) {
    return { data: null, error: { message: 'Invalid activity bucket.' } };
  }

  const { data, error } = await callRpc('coach_guest_list', {
    p_activity_bucket: input.activityBucket,
    p_limit: input.limit ?? 200,
  });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const guests = asArray(raw.guests)
    .map(parseGuestListRow)
    .filter((row): row is CoachGuestListRow => row !== null);

  return { data: guests, error: null };
}

export async function fetchCoachOnboardingStuckList(input?: {
  limit?: number;
}): Promise<{ data: CoachOnboardingStuckRow[] | null; error: CoachApiError | null }> {
  const { data, error } = await callRpc('coach_onboarding_stuck_list', {
    p_limit: input?.limit ?? 100,
  });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const users = asArray(raw.users)
    .map(parseOnboardingStuckRow)
    .filter((row): row is CoachOnboardingStuckRow => row !== null);

  return { data: users, error: null };
}

export async function fetchCoachUserDetail(userId: string): Promise<{
  data: CoachUserDetail | null;
  error: CoachApiError | null;
}> {
  const { data, error } = await callRpc('coach_user_detail', { p_user_id: userId });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const profile = parseUserProfile(asRecord(raw.profile));
  if (!profile) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const classificationHistory = asArray(raw.classificationHistory)
    .map(parseClassificationEvent)
    .filter((row): row is CoachUserClassificationEvent => row !== null);

  const missions = asArray(raw.missions)
    .map(parseUserMissionRow)
    .filter((row): row is CoachUserMissionRow => row !== null);

  return {
    data: {
      profile,
      classificationHistory,
      missions,
      summary: parseUserSummary(asRecord(raw.summary)),
      overtraining: parseOvertraining(asRecord(raw.overtraining)),
    },
    error: null,
  };
}

export async function fetchCoachDashboard(): Promise<{
  data: CoachDashboard | null;
  error: CoachApiError | null;
}> {
  const { data, error } = await callRpc('coach_dashboard');

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return {
    data: {
      topStrip: parseTopStrip(asRecord(raw.topStrip)),
      claimFunnel: parseClaimFunnel(asRecord(raw.claimFunnel)),
      intakeFunnel: parseIntakeFunnel(asRecord(raw.intakeFunnel)),
      rallyConversion: parseRallyConversion(asRecord(raw.rallyConversion)),
      missionAbandonment: parseMissionAbandonment(asRecord(raw.missionAbandonment)),
      templatePerformance: asArray(raw.templatePerformance).map(parseTemplateRow),
      hostVsJoinerRetention: asArray(raw.hostVsJoinerRetention).map(parseHostVsJoinerRow),
      audioUnlockRate: asArray(raw.audioUnlockRate).map(parseAudioUnlockRow),
      rpcReliability: asArray(raw.rpcReliability).map(parseRpcReliabilityRow),
      realtimeReliability: asArray(raw.realtimeReliability).map(parseRealtimeReliabilityRow),
    },
    error: null,
  };
}

export async function fetchCoachAnonSummary(anonId: string): Promise<{
  data: CoachAnonSummary | null;
  error: CoachApiError | null;
}> {
  if (!isLinkableAnonId(anonId)) {
    return { data: null, error: { message: 'This browser id is not valid.' } };
  }

  const { data, error } = await callRpc('coach_anon_summary', { p_anon_id: anonId });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    if (raw.reason === 'invalid_anon_id') {
      return { data: null, error: { message: 'This browser id is not valid.' } };
    }
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const summary = parseCoachAnonSummary(raw);
  if (!summary) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: summary, error: null };
}

export async function fetchCoachRecentEvents(input: {
  eventName?: string | null;
  limit?: number;
  userId?: string | null;
  anonId?: string | null;
}): Promise<{ data: CoachEventRow[] | null; error: CoachApiError | null }> {
  const { data, error } = await callRpc('coach_events_recent', {
    p_event_name: input.eventName ?? null,
    p_limit: input.limit ?? 100,
    p_user_id: input.userId ?? null,
    p_anon_id: input.anonId ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapCoachError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const events = asArray(raw.events)
    .map(parseEventRow)
    .filter((row): row is CoachEventRow => row !== null);

  return { data: events, error: null };
}
