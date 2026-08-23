import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  mapSendMessageReason,
  sendMessage,
  validateMessageBody,
  MESSAGE_MAX_LENGTH,
} from '@/lib/api/sendMessage';
import type { MessageRow } from '@/lib/sessionSync/types';

interface SessionChatProps {
  sessionId: string;
  participantId: string;
  claimToken: string | null;
  isAuthenticated: boolean;
  messages: MessageRow[];
  className?: string;
}

export function SessionChat({
  sessionId,
  participantId,
  claimToken,
  isAuthenticated,
  messages,
  className,
}: SessionChatProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateMessageBody(input);
    if (!validation.ok) {
      setError(mapSendMessageReason(validation.reason));
      return;
    }

    const tokenForRpc = claimToken ?? '';
    if (!tokenForRpc && !isAuthenticated) {
      setError('Could not send message. Rejoin from this device if you still have access.');
      return;
    }

    setIsSending(true);

    const result = await sendMessage({
      sessionId,
      participantId,
      claimToken: tokenForRpc,
      body: validation.body,
    });

    setIsSending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data?.ok === false) {
      setError(mapSendMessageReason(result.data.reason));
      return;
    }

    setInput('');
  }

  return (
    <section
      className={`space-y-3 rounded border border-gray-300 p-4 ${className ?? ''}`}
    >
      <h2 className="text-sm font-semibold lg:text-base">Chat</h2>

      <div
        ref={listRef}
        className="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm lg:max-h-none lg:min-h-0 lg:flex-1"
      >
        {messages.length === 0 ? (
          <p className="text-gray-600">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-0.5">
              <p className="text-xs text-gray-500">
                {message.nickname} · {new Date(message.created_at).toLocaleTimeString()}
              </p>
              <p>{message.body}</p>
            </div>
          ))
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Type a message…"
          value={input}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={isSending}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSending}
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
