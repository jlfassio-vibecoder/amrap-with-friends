import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SessionChat } from './SessionChat';
import type { MessageRow } from '@/lib/sessionSync/types';

const sendMessageMock = vi.fn();

vi.mock('@/lib/api/sendMessage', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/sendMessage')>('@/lib/api/sendMessage');
  return {
    ...actual,
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  };
});

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

function buildMessage(id: string, body: string, createdAt: string, nickname = 'Host'): MessageRow {
  return {
    id,
    session_id: SESSION_ID,
    participant_id: PARTICIPANT_ID,
    nickname,
    body,
    segment_index: 0,
    created_at: createdAt,
  };
}

afterEach(() => {
  cleanup();
  sendMessageMock.mockReset();
});

describe('SessionChat', () => {
  it('renders messages in ascending order', () => {
    const messages = [
      buildMessage('msg-1', 'First', '2026-08-25T12:00:00.000Z'),
      buildMessage('msg-2', 'Second', '2026-08-25T12:01:00.000Z'),
    ];

    render(
      <SessionChat
        sessionId={SESSION_ID}
        participantId={PARTICIPANT_ID}
        claimToken="claim-token"
        isAuthenticated={false}
        messages={messages}
      />
    );

    const bodies = screen.getAllByText(/First|Second/);
    expect(bodies[0].textContent).toBe('First');
    expect(bodies[1].textContent).toBe('Second');
  });

  it('uses a scrollable message list container', () => {
    render(
      <SessionChat
        sessionId={SESSION_ID}
        participantId={PARTICIPANT_ID}
        claimToken="claim-token"
        isAuthenticated={false}
        messages={[]}
      />
    );

    const list = screen.getByTestId('session-chat-message-list');
    expect(list.className).toContain('overflow-y-auto');
    expect(list.className).toContain('min-h-0');
    expect(list.className).toContain('flex-1');
  });

  it('sends a message and clears the input', async () => {
    sendMessageMock.mockResolvedValue({
      data: {
        ok: true,
        messageId: 'msg-new',
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        nickname: 'Host',
        body: 'Hello rally point',
        segmentIndex: 0,
        createdAt: '2026-08-25T12:02:00.000Z',
      },
      error: null,
    });

    render(
      <SessionChat
        sessionId={SESSION_ID}
        participantId={PARTICIPANT_ID}
        claimToken="claim-token"
        isAuthenticated={false}
        messages={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), {
      target: { value: 'Hello rally point' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        claimToken: 'claim-token',
        body: 'Hello rally point',
      });
    });
    expect((screen.getByPlaceholderText('Type a message…') as HTMLInputElement).value).toBe('');
  });
});
