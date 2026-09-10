import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  mapSendMessageReason,
  sendMessage,
  validateMessageBody,
  MESSAGE_MAX_LENGTH,
} from '@/lib/api/sendMessage';
import type { MessageRow } from '@/lib/missionSync/types';

interface MissionChatProps {
  missionId: string;
  participantId: string;
  claimToken: string | null;
  isAuthenticated: boolean;
  messages: MessageRow[];
  className?: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function MissionChat({
  missionId,
  participantId,
  claimToken,
  isAuthenticated,
  messages,
  className,
  expanded,
  onExpandedChange,
}: MissionChatProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    if (!expanded) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [expanded, messages.length]);

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
      missionId,
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
    onExpandedChange(true);
  }

  return (
    <section
      className={`card flex min-h-0 flex-col gap-3 overflow-hidden p-4 ${className ?? ''}`}
      data-walkthrough-id="chat"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-display text-sm text-ink lg:text-base">Chat</h2>
        <button
          type="button"
          className="text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-hover"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Close' : 'Open'}
        </button>
      </div>

      {expanded ? (
        <div
          ref={listRef}
          data-testid="mission-chat-message-list"
          className="max-h-48 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-card border border-divider bg-page p-3 text-sm lg:max-h-none"
        >
          {messages.length === 0 ? (
            <p className="text-secondary">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-0.5">
                <p className="text-xs text-muted">
                  {message.nickname} · {new Date(message.created_at).toLocaleTimeString()}
                </p>
                <p>{message.body}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {error ? <p className="text-error shrink-0 text-sm">Error: {error}</p> : null}

      <form className="flex shrink-0 gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          className="input-field min-w-0 flex-1 text-sm"
          placeholder="Type a message…"
          value={input}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={isSending}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="btn-neutral text-sm" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
