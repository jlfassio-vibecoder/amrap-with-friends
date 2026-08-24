import { createClient } from '@supabase/supabase-js';
import {
  handleSubmitParticipantResult,
  type SubmitParticipantResultRequest,
} from './handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, reason: 'server_misconfigured' }, 500);
  }

  let body: SubmitParticipantResultRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_json' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  let authUserId: string | null = null;

  if (authHeader) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    authUserId = userData.user?.id ?? null;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await handleSubmitParticipantResult(body, {
    authUserId,
    fetchParticipant: async (participantId) => {
      const { data, error } = await adminClient
        .from('participants')
        .select('claim_token_hash, session_id, user_id')
        .eq('id', participantId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    },
    fetchSession: async (sessionId) => {
      const { data, error } = await adminClient
        .from('sessions')
        .select('state, segment_index, workout, duration_minutes')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        state: data.state,
        segment_index: data.segment_index,
        workout: data.workout,
        duration_minutes: data.duration_minutes,
      };
    },
    fetchExistingResult: async (participantId, segmentIndex) => {
      const { data, error } = await adminClient
        .from('participant_segment_results')
        .select('score_breakdown')
        .eq('participant_id', participantId)
        .eq('segment_index', segmentIndex)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data ?? { score_breakdown: null };
    },
    fetchRounds: async (participantId, segmentIndex) => {
      const { data, error } = await adminClient
        .from('rounds')
        .select('round_index, elapsed_sec_at_round')
        .eq('participant_id', participantId)
        .eq('segment_index', segmentIndex)
        .order('round_index', { ascending: true });

      if (error || !data) {
        return [];
      }

      return data;
    },
    persistResult: async (input) => {
      const { data: updated, error: updateError } = await adminClient
        .from('participant_segment_results')
        .update({
          partial_reps: input.partialReps,
          final_score: input.finalScore,
          score_breakdown: input.scoreBreakdown,
          updated_at: new Date().toISOString(),
        })
        .eq('participant_id', input.participantId)
        .eq('segment_index', input.segmentIndex)
        .is('score_breakdown', null)
        .select('participant_id')
        .maybeSingle();

      if (updateError) {
        return { ok: false as const, reason: 'persist_failed' };
      }

      if (updated) {
        return { ok: true as const };
      }

      const { data: inserted, error: insertError } = await adminClient
        .from('participant_segment_results')
        .insert({
          participant_id: input.participantId,
          segment_index: input.segmentIndex,
          partial_reps: input.partialReps,
          final_score: input.finalScore,
          score_breakdown: input.scoreBreakdown,
        })
        .select('participant_id')
        .maybeSingle();

      if (insertError || !inserted) {
        const { data: locked } = await adminClient
          .from('participant_segment_results')
          .select('score_breakdown')
          .eq('participant_id', input.participantId)
          .eq('segment_index', input.segmentIndex)
          .maybeSingle();

        if (locked?.score_breakdown !== null && locked?.score_breakdown !== undefined) {
          return { ok: false as const, reason: 'score_already_locked' };
        }

        return { ok: false as const, reason: 'persist_failed' };
      }

      return { ok: true as const };
    },
  });

  return jsonResponse(result, result.ok ? 200 : 400);
});
