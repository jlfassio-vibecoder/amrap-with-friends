import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

vi.mock('@/lib/missionIdentity', () => ({
  persistMissionIdentity: vi.fn(),
}));

import {
  acceptInvitation,
  createInvitation,
  parseInvitationCard,
  parseMessageAttachment,
  saveChatInvitation,
} from './invitations';
import { persistMissionIdentity } from '@/lib/missionIdentity';

const FROM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DEL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MISSION = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PARTICIPANT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const WORKOUT = [{ name: 'Burpees', target: 12, unit: 'reps' }];
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseInvitationCard', () => {
  it('parses an inbox workout card without tokens or invite codes', () => {
    const card = parseInvitationCard({
      invitation_id: INV,
      delivery_id: DEL,
      type: 'workout',
      status: 'pending',
      read_at: null,
      created_at: '2026-09-11T12:00:00.000Z',
      note: 'Same time tomorrow?',
      from_user_id: FROM,
      from_nickname: 'Alex',
      include_squad_invite: false,
      duration_minutes: 15,
      workout: WORKOUT,
      host_token: 'should-not-leak',
      invite_code: 'NOPE',
    });
    expect(card).toMatchObject({
      invitationId: INV,
      deliveryId: DEL,
      type: 'workout',
      fromNickname: 'Alex',
      note: 'Same time tomorrow?',
      durationMinutes: 15,
    });
    expect(card).not.toHaveProperty('hostToken');
    expect(JSON.stringify(card)).not.toContain('should-not-leak');
    expect(JSON.stringify(card)).not.toContain('NOPE');
  });

  it('returns null when the type is missing', () => {
    expect(parseInvitationCard({ invitation_id: INV, from_user_id: FROM })).toBeNull();
  });
});

describe('parseMessageAttachment', () => {
  it('reads a typed invitation attachment and ignores ordinary objects', () => {
    expect(parseMessageAttachment({ type: 'invitation', invitation_id: INV })).toEqual({
      type: 'invitation',
      invitationId: INV,
    });
    expect(parseMessageAttachment({ type: 'text', invitation_id: INV })).toBeNull();
    expect(parseMessageAttachment(null)).toBeNull();
  });
});

describe('createInvitation', () => {
  it('sends recipients, chat, and a client request id', async () => {
    callRpcMock.mockResolvedValue({
      data: { invitation_id: INV, delivery_count: 2, skipped: 0, replayed: false },
      error: null,
    });
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue(TO);

    const result = await createInvitation({
      type: 'workout',
      recipientUserIds: [FROM],
      postInChat: true,
      includeAllMissionParticipants: false,
      note: '  Join me  ',
      sourceMissionId: MISSION,
      durationMinutes: 15,
      workout: WORKOUT,
    });

    expect(callRpcMock).toHaveBeenCalledWith(
      'create_invitation',
      expect.objectContaining({
        p_type: 'workout',
        p_recipient_user_ids: [FROM],
        p_post_in_chat: true,
        p_note: 'Join me',
        p_source_mission_id: MISSION,
        p_duration_minutes: 15,
        p_client_request_id: TO,
      })
    );
    expect(result.error).toBeNull();
    expect(result.data?.deliveryCount).toBe(2);
    uuid.mockRestore();
  });

  it('maps a block refusal into recipient copy', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'They have blocked invitations from you' },
    });
    const result = await createInvitation({
      type: 'workout',
      recipientUserIds: [FROM],
      durationMinutes: 15,
      workout: WORKOUT,
    });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('They are not receiving invitations from you.');
  });
});

describe('acceptInvitation', () => {
  it('persists identity when a shared workout starts a mission', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        type: 'workout',
        mission_id: MISSION,
        host_token: 'host-secret',
        participant_id: PARTICIPANT,
        recovered: true,
      },
      error: null,
    });

    const result = await acceptInvitation(DEL, 'Alex');

    expect(callRpcMock).toHaveBeenCalledWith('accept_invitation', {
      p_delivery_id: DEL,
      p_nickname: 'Alex',
    });
    expect(persistMissionIdentity).toHaveBeenCalledWith(MISSION, {
      nickname: 'Alex',
      participantId: PARTICIPANT,
      hostToken: 'host-secret',
    });
    expect(result.data).toMatchObject({ type: 'workout', missionId: MISSION, recovered: true });
  });
});

describe('saveChatInvitation', () => {
  it('returns the delivery id so chat can start without a fake id', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, delivery_id: DEL, already: false },
      error: null,
    });
    const result = await saveChatInvitation(INV);
    expect(callRpcMock).toHaveBeenCalledWith('save_chat_invitation', { p_invitation_id: INV });
    expect(result.deliveryId).toBe(DEL);
    expect(result.already).toBe(false);
  });
});

describe('in-app invitations migration contract', () => {
  const sql = readFileSync(
    join(root, 'supabase/migrations/20260912320000_in_app_invitations.sql'),
    'utf8'
  );

  it('creates invitation + delivery tables and wraps existing assigned workouts', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.invitations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.invitation_deliveries');
    expect(sql).toContain('FROM public.assigned_workouts');
    expect(sql).toContain('WHERE invitation_id IS NULL');
    expect(sql).toContain("'workout'");
  });

  it('creates chat cards and deliveries in one RPC with retry-safe client ids', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_invitation(');
    expect(sql).toContain('p_client_request_id');
    expect(sql).toContain("'replayed', true");
    expect(sql).toContain("jsonb_build_object('type', 'invitation', 'invitation_id'");
  });

  it('recovers a started workout mission in the same accept path', () => {
    expect(sql).toContain("'recovered', true");
    expect(sql).toContain('v_created := public.create_mission(');
    expect(sql).toContain("SET status = 'started'");
  });

  it('does not put tokens or invite codes on the shared card payload', () => {
    const cardFn = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.invitation_card_json'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.create_invitation')
    );
    expect(cardFn).not.toContain('host_token');
    expect(cardFn).not.toContain('claim_token');
    expect(cardFn).not.toContain('invite_code');
    expect(cardFn).toContain('mission_participant_limit()');
  });

  it('locks the sender and keeps a pending squad bundle from closing the delivery', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.invitation_lock_sender(');
    expect(sql).toContain('PERFORM public.invitation_lock_sender(v_uid)');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.invitation_squad_still_pending(');
  });

  it('marks invitation deliveries when start_assigned_workout resolves the workout', () => {
    const startFn = sql.slice(
      sql.lastIndexOf('CREATE OR REPLACE FUNCTION public.start_assigned_workout('),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.get_mission_live_state(')
    );
    expect(startFn).toContain('UPDATE public.invitation_deliveries');
    expect(startFn).toContain('resulting_mission_id = p_mission_id');
    expect(startFn).toContain('invitation_squad_still_pending');
  });

  it('saves a late chat squad bundle as the original sender, after locking', () => {
    const saveFn = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.save_chat_invitation('),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.invitation_audience(')
    );
    const lockAt = saveFn.indexOf('PERFORM public.invitation_lock_sender');
    const rereadAt = saveFn.indexOf('SELECT * INTO v_existing');
    expect(lockAt).toBeGreaterThan(-1);
    expect(rereadAt).toBeGreaterThan(lockAt);
    expect(saveFn).toContain("'already', true");
    expect(saveFn).toContain(
      'INSERT INTO public.squad_requests (from_user_id, to_user_id, status)'
    );
    expect(saveFn).toContain("VALUES (v_inv.from_user_id, v_uid, 'pending')");
    expect(saveFn).not.toContain('public.send_squad_invite');
  });
});
