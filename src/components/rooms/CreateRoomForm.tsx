import { useState, type FormEvent } from 'react';
import { createRoom } from '@/lib/api/rooms';
import { checkHandle, handleRejectionMessage, HANDLE_MAX } from '@/lib/rooms/handles';

/**
 * Claiming a room.
 *
 * The handle is checked here before it is sent, purely so a host learns *why*
 * one is refused while they are still typing. The database is what actually
 * enforces it -- reserved_handles and the unique index -- because this check
 * runs in a browser, and anything running in a browser can be skipped.
 */
export function CreateRoomForm({ onCreated }: { onCreated: (handle: string) => void }) {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typed = handle.trim();
  const check = typed.length > 0 ? checkHandle(typed) : null;
  const localError = check && !check.ok ? handleRejectionMessage(check.reason) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!check?.ok) {
      setError(localError ?? 'Choose a handle for your room.');
      return;
    }
    if (displayName.trim().length === 0) {
      setError('Give your room a name athletes will recognise.');
      return;
    }

    setBusy(true);
    const result = await createRoom({ handle: check.handle, displayName: displayName.trim() });
    setBusy(false);

    if (!result.ok) {
      setError(reasonMessage(result.reason));
      return;
    }
    onCreated(result.handle);
  }

  return (
    <form className="card space-y-3 p-4 text-sm" onSubmit={(event) => void submit(event)}>
      <p className="font-semibold">Claim your room</p>
      <p className="text-secondary">
        Your room lives at a permanent address you can put in a bio. You can change the name later;
        the handle stays.
      </p>

      <label className="block">
        <span className="eyebrow text-secondary">Handle</span>
        <span className="mt-1 flex items-center gap-1">
          <span className="text-secondary">@</span>
          <input
            className="input-field flex-1"
            value={handle}
            maxLength={HANDLE_MAX}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="bay_area_crossfit"
            onChange={(event) => setHandle(event.target.value)}
          />
        </span>
      </label>

      <label className="block">
        <span className="eyebrow text-secondary">Room name</span>
        <input
          className="input-field mt-1 w-full"
          value={displayName}
          maxLength={80}
          placeholder="Bay Area CrossFit"
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>

      {localError ? <p className="text-xs text-secondary">{localError}</p> : null}
      {error ? <p className="text-accent">{error}</p> : null}

      <button type="submit" className="btn-primary text-sm" disabled={busy}>
        {busy ? 'Claiming…' : 'Claim this room'}
      </button>
    </form>
  );
}

/** Server reasons, said the way a host would say them. */
function reasonMessage(reason: string): string {
  switch (reason) {
    case 'handle_reserved':
      return 'That one is reserved. Try adding your sport, city, or gym name.';
    case 'handle_taken':
      return 'That handle is taken. Try another.';
    case 'room_exists':
      return 'You already have a room.';
    case 'invalid_handle':
      return 'Use lowercase letters, numbers and underscores, starting with a letter or number.';
    case 'not_authenticated':
      return 'Sign in first.';
    default:
      return `Could not claim that room: ${reason}`;
  }
}
