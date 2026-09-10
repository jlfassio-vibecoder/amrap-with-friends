import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSegmentResultRow } from '@/lib/realtime/missionChannelUtils';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migrations = join(root, 'supabase/migrations');

const CHECK_IN_COLUMNS = ['rpe', 'session_notes', 'check_ins'] as const;

/**
 * A check-in is private to the athlete who wrote it.
 *
 * Nothing in the product shows one athlete another's notes, pain mark, mood or
 * sleep, and nothing should: the write path asks for them under "Anything else
 * to remember next time?", which is a promise about audience. The live mission
 * payload is the opposite of private — it is every participant's rows, sent to
 * every participant and to guests holding a claim token — so these assertions
 * guard the one boundary that a routine "carry the new column on the read
 * paths" change would quietly cross.
 */
describe('check-ins stay private to their author', () => {
  it('is not carried on the live-state payload the whole mission receives', () => {
    const liveState = readFileSync(
      join(migrations, '20260909200000_check_in_is_private.sql'),
      'utf8'
    );
    const segmentSelect = /INTO v_segment_results[\s\S]*?\) psr;/.exec(liveState);
    expect(segmentSelect, 'segment_results select not found').not.toBeNull();

    for (const column of CHECK_IN_COLUMNS) {
      expect(segmentSelect![0]).not.toContain(column);
    }
  });

  it('is not granted to anon or authenticated for direct table reads', () => {
    // The membership RLS policy is USING (is_mission_participant(mission_id)),
    // so a column grant here is a grant to every teammate, not just the author.
    const revoke = readFileSync(join(migrations, '20260909200000_check_in_is_private.sql'), 'utf8');
    for (const column of CHECK_IN_COLUMNS) {
      expect(revoke).toContain(
        `REVOKE SELECT (${column}) ON public.participant_segment_results FROM anon, authenticated;`
      );
    }
  });

  it('is dropped from a realtime row even when the server sends it', () => {
    // Belt and braces: an older deployment, or a row replicated before the
    // revoke lands, must not put another athlete's notes into this client.
    const row = parseSegmentResultRow({
      mission_id: 'm1',
      participant_id: 'p1',
      segment_index: 0,
      partial_reps: 0,
      final_score: 100,
      score_breakdown: null,
      modified_movements: null,
      movement_variants: null,
      rpe: 9,
      session_notes: 'shoulder felt wrong all the way through',
      check_ins: { pain: 'pain--felt' },
      updated_at: '2026-01-01T10:00:00.000Z',
    });

    expect(row).not.toBeNull();
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('shoulder felt wrong');
    expect(serialized).not.toContain('pain--felt');
    for (const column of CHECK_IN_COLUMNS) {
      expect(row as object).not.toHaveProperty(column);
    }
  });
});
