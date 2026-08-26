import { callRpc } from '@/lib/api/callRpc';

export const MESSAGE_MAX_LENGTH = 500;

export interface SendMessageInput {
  sessionId: string;
  participantId: string;
  claimToken: string;
  body: string;
}

export interface SendMessageSuccess {
  ok: true;
  messageId: string;
  sessionId: string;
  participantId: string;
  nickname: string;
  body: string;
  segmentIndex: number;
  createdAt: string;
}

export interface SendMessageFailure {
  ok: false;
  reason: string;
}

export type SendMessageResult = SendMessageSuccess | SendMessageFailure;

export type SendMessageApiError = {
  message: string;
};

export type ValidateMessageBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: 'empty_body' | 'body_too_long' };

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export function validateMessageBody(body: string): ValidateMessageBodyResult {
  const trimmed = body.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty_body' };
  }

  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: 'body_too_long' };
  }

  return { ok: true, body: trimmed };
}

function mapRpcError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Invalid message')) {
    return 'Could not send message. Please try again.';
  }
  if (message.includes('Participant not found')) {
    return 'Participant not found.';
  }
  if (message.includes('Session not found')) {
    return 'Session not found.';
  }
  return 'Something went wrong. Please try again.';
}

export function mapSendMessageReason(reason: string): string {
  switch (reason) {
    case 'empty_body':
      return 'Message cannot be empty.';
    case 'body_too_long':
      return `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`;
    case 'invalid_claim_token':
      return 'Could not send message. Rejoin from this device if you still have access.';
    default:
      return `Could not send message: ${reason}`;
  }
}

export async function sendMessage(
  input: SendMessageInput
): Promise<{ data: SendMessageResult | null; error: SendMessageApiError | null }> {
  const { data, error } = await callRpc('send_message', {
    p_session_id: input.sessionId,
    p_participant_id: input.participantId,
    p_claim_token: input.claimToken,
    p_body: input.body,
  });

  if (error) {
    return { data: null, error: { message: mapRpcError(error.message) } };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const ok = raw.ok === true;

  if (!ok) {
    const reason = readString(raw.reason) ?? 'unknown';
    return {
      data: { ok: false, reason },
      error: null,
    };
  }

  const messageId = readString(raw.message_id);
  const sessionId = readString(raw.session_id);
  const participantId = readString(raw.participant_id);
  const nickname = readString(raw.nickname);
  const body = readString(raw.body);
  const segmentIndex = readNumber(raw.segment_index);
  const createdAtRaw = raw.created_at;
  const createdAt =
    createdAtRaw === null || createdAtRaw === undefined
      ? null
      : readString(String(createdAtRaw));

  if (
    !messageId ||
    !sessionId ||
    !participantId ||
    !nickname ||
    !body ||
    segmentIndex === null ||
    !createdAt
  ) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return {
    data: {
      ok: true,
      messageId,
      sessionId,
      participantId,
      nickname,
      body,
      segmentIndex,
      createdAt,
    },
    error: null,
  };
}
