import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MESSAGE_MAX_LENGTH,
  mapSendMessageReason,
  sendMessage,
  validateMessageBody,
} from './sendMessage';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const MESSAGE_ID = 'aaaa1111-1111-4111-8111-111111111111';

describe('validateMessageBody', () => {
  it('rejects empty and whitespace-only bodies', () => {
    expect(validateMessageBody('')).toEqual({ ok: false, reason: 'empty_body' });
    expect(validateMessageBody('   ')).toEqual({ ok: false, reason: 'empty_body' });
  });

  it('rejects bodies longer than max length', () => {
    const longBody = 'a'.repeat(MESSAGE_MAX_LENGTH + 1);
    expect(validateMessageBody(longBody)).toEqual({ ok: false, reason: 'body_too_long' });
  });

  it('returns trimmed body on success', () => {
    expect(validateMessageBody('  hello  ')).toEqual({ ok: true, body: 'hello' });
  });
});

describe('mapSendMessageReason', () => {
  it('maps known reasons to user-facing messages', () => {
    expect(mapSendMessageReason('empty_body')).toContain('empty');
    expect(mapSendMessageReason('body_too_long')).toContain(String(MESSAGE_MAX_LENGTH));
    expect(mapSendMessageReason('invalid_claim_token')).toContain('Rejoin');
  });
});

describe('sendMessage API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls send_message RPC with trimmed body', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        participant_id: PARTICIPANT_ID,
        nickname: 'Host',
        body: 'hello',
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await sendMessage({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      body: '  hello  ',
    });

    expect(rpcMock).toHaveBeenCalledWith('send_message', {
      p_session_id: SESSION_ID,
      p_participant_id: PARTICIPANT_ID,
      p_claim_token: 'claim-token',
      p_body: '  hello  ',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      messageId: MESSAGE_ID,
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      nickname: 'Host',
      body: 'hello',
      segmentIndex: 0,
      createdAt: '2026-08-22T12:00:00.000Z',
    });
  });

  it('parses empty_body without throwing', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'empty_body' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await sendMessage({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      body: 'hello',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'empty_body' });
  });

  it('parses invalid_claim_token without throwing', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_claim_token' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await sendMessage({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'wrong',
      body: 'hello',
    });

    expect(result.data).toEqual({ ok: false, reason: 'invalid_claim_token' });
  });
});
