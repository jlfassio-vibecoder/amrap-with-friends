import { callRpc } from '@/lib/api/callRpc';

export type CoachApiError = { message: string };

export interface CoachTopStrip {
  sessionsCreated7d: number;
  sessionsCreated30d: number;
  sessionsFinished7d: number;
  sessionsFinished30d: number;
  uniqueAnonIds: number;
  registeredUsers: number;
  practiceSessionsStarted: number;
  liveSessionsCreated: number;
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

export interface CoachSessionAbandonment {
  sessionsFinished: number;
  sessionsWithAbandonmentEvent: number;
  abandonmentRatePct: number | null;
}

export interface CoachTemplatePerformanceRow {
  templateId: string;
  intensityTier: number | null;
  durationMinutes: number;
  sessionsCreated: number;
  sessionsCompleted: number;
  completionRatePct: number | null;
}

export interface CoachHostVsJoinerRow {
  firstRole: string;
  userCount: number;
  avgSessionsPerUser: number | null;
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
  sessionAbandonment: CoachSessionAbandonment;
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
  sessionId: string | null;
  participantId: string | null;
  userId: string | null;
  anonId: string | null;
  route: string | null;
  props: Record<string, unknown>;
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
    sessionsCreated7d: num(row, 'sessionsCreated7d'),
    sessionsCreated30d: num(row, 'sessionsCreated30d'),
    sessionsFinished7d: num(row, 'sessionsFinished7d'),
    sessionsFinished30d: num(row, 'sessionsFinished30d'),
    uniqueAnonIds: num(row, 'uniqueAnonIds'),
    registeredUsers: num(row, 'registeredUsers'),
    practiceSessionsStarted: num(row, 'practiceSessionsStarted'),
    liveSessionsCreated: num(row, 'liveSessionsCreated'),
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

function parseSessionAbandonment(row: Record<string, unknown>): CoachSessionAbandonment {
  return {
    sessionsFinished: num(row, 'sessions_finished'),
    sessionsWithAbandonmentEvent: num(row, 'sessions_with_abandonment_event'),
    abandonmentRatePct: numOrNull(row, 'abandonment_rate_pct'),
  };
}

function parseTemplateRow(row: Record<string, unknown>): CoachTemplatePerformanceRow {
  return {
    templateId: str(row, 'template_id'),
    intensityTier: numOrNull(row, 'intensity_tier'),
    durationMinutes: num(row, 'duration_minutes'),
    sessionsCreated: num(row, 'sessions_created'),
    sessionsCompleted: num(row, 'sessions_completed'),
    completionRatePct: numOrNull(row, 'completion_rate_pct'),
  };
}

function parseHostVsJoinerRow(row: Record<string, unknown>): CoachHostVsJoinerRow {
  return {
    firstRole: str(row, 'first_role'),
    userCount: num(row, 'user_count'),
    avgSessionsPerUser: numOrNull(row, 'avg_sessions_per_user'),
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
    sessionId: strOrNull(row, 'session_id'),
    participantId: strOrNull(row, 'participant_id'),
    userId: strOrNull(row, 'user_id'),
    anonId: strOrNull(row, 'anon_id'),
    route: strOrNull(row, 'route'),
    props: asRecord(row.props),
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
      sessionAbandonment: parseSessionAbandonment(asRecord(raw.sessionAbandonment)),
      templatePerformance: asArray(raw.templatePerformance).map(parseTemplateRow),
      hostVsJoinerRetention: asArray(raw.hostVsJoinerRetention).map(parseHostVsJoinerRow),
      audioUnlockRate: asArray(raw.audioUnlockRate).map(parseAudioUnlockRow),
      rpcReliability: asArray(raw.rpcReliability).map(parseRpcReliabilityRow),
      realtimeReliability: asArray(raw.realtimeReliability).map(parseRealtimeReliabilityRow),
    },
    error: null,
  };
}

export async function fetchCoachRecentEvents(input: {
  eventName?: string | null;
  limit?: number;
}): Promise<{ data: CoachEventRow[] | null; error: CoachApiError | null }> {
  const { data, error } = await callRpc('coach_events_recent', {
    p_event_name: input.eventName ?? null,
    p_limit: input.limit ?? 100,
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
