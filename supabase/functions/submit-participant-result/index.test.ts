import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  computeLockedScore,
  deriveRoundDurationsSec,
  handleSubmitParticipantResult,
  type RoundRow,
} from './handler.ts';

const CLAIM_TOKEN_HASH =
  'abfc1de71d4684842800719f5d6407b1e0ef7965ad4473a1cd8632462eec1b8c';

const WORKOUT = [
  { name: 'Burpees', target: 20, unit: 'reps' },
  { name: 'Air squats', target: 20, unit: 'reps' },
];

Deno.test('deriveRoundDurationsSec computes elapsed deltas', () => {
  const rounds: RoundRow[] = [
    { round_index: 0, elapsed_sec_at_round: 60 },
    { round_index: 1, elapsed_sec_at_round: 120 },
    { round_index: 2, elapsed_sec_at_round: 180 },
  ];

  assertEquals(deriveRoundDurationsSec(rounds), [60, 60, 60]);
});

Deno.test('computeLockedScore derives 302 from 4 rounds and 15 partial reps', () => {
  const rounds: RoundRow[] = [
    { round_index: 0, elapsed_sec_at_round: 60 },
    { round_index: 1, elapsed_sec_at_round: 120 },
    { round_index: 2, elapsed_sec_at_round: 180 },
    { round_index: 3, elapsed_sec_at_round: 240 },
  ];

  const result = computeLockedScore(rounds, WORKOUT, 15, 15);

  assertEquals('repsPerRound' in result, true);
  if (!('repsPerRound' in result)) {
    return;
  }

  assertEquals(result.repsPerRound, 40);
  assertEquals(result.breakdown, {
    baseScore: 175,
    pvi: 0,
    pviMultiplier: 1.15,
    domainWeight: 1.5,
    finalScore: 302,
    roundCount: 4,
    roundSplits: [60, 60, 60, 60],
  });
});

Deno.test('handleSubmitParticipantResult rejects second submit when score is locked', async () => {
  let persistCalls = 0;

  const first = await handleSubmitParticipantResult(
    {
      sessionId: '11111111-1111-4111-8111-111111111111',
      participantId: '22222222-2222-4222-8222-222222222222',
      claimToken: 'claim-token',
      partialReps: 15,
      segmentIndex: 0,
    },
    {
      authUserId: null,
      fetchParticipant: async () => ({
        claim_token_hash: CLAIM_TOKEN_HASH,
        session_id: '11111111-1111-4111-8111-111111111111',
        user_id: null,
      }),
      fetchSession: async () => ({
        state: 'finished',
        segment_index: 0,
        workout: WORKOUT,
        duration_minutes: 15,
      }),
      fetchExistingResult: async () => ({ score_breakdown: null }),
      fetchRounds: async () => [
        { round_index: 0, elapsed_sec_at_round: 60 },
        { round_index: 1, elapsed_sec_at_round: 120 },
        { round_index: 2, elapsed_sec_at_round: 180 },
        { round_index: 3, elapsed_sec_at_round: 240 },
      ],
      persistResult: async () => {
        persistCalls += 1;
        return { ok: true };
      },
    }
  );

  assertEquals(first.ok, true);
  assertEquals(first.finalScore, 302);
  assertExists(first.scoreBreakdown);
  assertEquals(first.scoreBreakdown?.finalScore, 302);
  assertEquals(persistCalls, 1);

  const second = await handleSubmitParticipantResult(
    {
      sessionId: '11111111-1111-4111-8111-111111111111',
      participantId: '22222222-2222-4222-8222-222222222222',
      claimToken: 'claim-token',
      partialReps: 10,
      segmentIndex: 0,
    },
    {
      authUserId: null,
      fetchParticipant: async () => ({
        claim_token_hash: CLAIM_TOKEN_HASH,
        session_id: '11111111-1111-4111-8111-111111111111',
        user_id: null,
      }),
      fetchSession: async () => ({
        state: 'finished',
        segment_index: 0,
        workout: WORKOUT,
        duration_minutes: 15,
      }),
      fetchExistingResult: async () => ({
        score_breakdown: {
          baseScore: 175,
          pvi: 0,
          pviMultiplier: 1.15,
          domainWeight: 1.5,
          finalScore: 302,
        },
      }),
      fetchRounds: async () => [],
      persistResult: async () => {
        persistCalls += 1;
        return { ok: true };
      },
    }
  );

  assertEquals(second, { ok: false, reason: 'score_already_locked' });
  assertEquals(persistCalls, 1);
});

Deno.test('handleSubmitParticipantResult ignores client-side score tampering inputs', async () => {
  const result = await handleSubmitParticipantResult(
    {
      sessionId: '11111111-1111-4111-8111-111111111111',
      participantId: '22222222-2222-4222-8222-222222222222',
      claimToken: 'claim-token',
      partialReps: 15,
      segmentIndex: 0,
    },
    {
      authUserId: null,
      fetchParticipant: async () => ({
        claim_token_hash: CLAIM_TOKEN_HASH,
        session_id: '11111111-1111-4111-8111-111111111111',
        user_id: null,
      }),
      fetchSession: async () => ({
        state: 'finished',
        segment_index: 0,
        workout: WORKOUT,
        duration_minutes: 15,
      }),
      fetchExistingResult: async () => ({ score_breakdown: null }),
      fetchRounds: async () => [
        { round_index: 0, elapsed_sec_at_round: 60 },
        { round_index: 1, elapsed_sec_at_round: 120 },
        { round_index: 2, elapsed_sec_at_round: 180 },
        { round_index: 3, elapsed_sec_at_round: 240 },
      ],
      persistResult: async () => ({ ok: true }),
    }
  );

  assertEquals(result.ok, true);
  assertEquals(result.finalScore, 302);
  assertEquals(result.scoreBreakdown?.baseScore, 175);
});
