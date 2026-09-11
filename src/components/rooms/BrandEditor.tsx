import { useState } from 'react';
import { setRoomBrand } from '@/lib/api/rooms';
import {
  legibleAccent,
  normalizeHex,
  roomCardMark,
  roomShareTheme,
  type RoomBrand,
} from '@/lib/rooms/brand';
import { AWF_THEME } from '@/lib/share/renderer/theme';

/**
 * The room's colour, and what it will actually look like on a card.
 *
 * Two swatches rather than one, because the colour a coach picks is not always
 * the colour that ships: an accent too close to the card's near-black
 * background is lifted until it can be read. Showing both is the difference
 * between a considered rule and a bug the coach discovers on Instagram.
 */
export function BrandEditor({
  roomId,
  handle,
  current,
  onSaved,
}: {
  roomId: string;
  handle: string;
  current: RoomBrand | null;
  onSaved: () => void;
}) {
  const [accent, setAccent] = useState(current?.accent ?? AWF_THEME.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeHex(accent);
  const shipped = normalized ? legibleAccent(normalized, AWF_THEME.background) : null;
  const lifted = normalized !== null && shipped !== normalized;
  const unchanged = normalized === (current?.accent ?? null);
  const theme = roomShareTheme(normalized ? { accent: normalized } : null);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    const result = await setRoomBrand(roomId, value);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === 'forbidden'
          ? 'Only this room’s owner can change its colour.'
          : `Could not save that: ${result.reason}`
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="eyebrow text-secondary" htmlFor="room-accent">
          Colour
        </label>
        <input
          id="room-accent"
          type="color"
          className="h-9 w-14 rounded border border-border bg-transparent"
          value={normalized ?? AWF_THEME.accent}
          onChange={(event) => setAccent(event.target.value)}
        />
        <code className="text-xs text-secondary">{normalized ?? '—'}</code>
      </div>

      {/* A strip of the card itself, drawn in the colours the renderer would
          use, so the preview cannot disagree with the card. */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: theme.background, color: theme.ink }}
        aria-label="Card preview"
      >
        <div className="text-2xl font-extrabold" style={{ color: theme.accent }}>
          7 rounds
        </div>
        <div className="mt-2 h-1 w-16" style={{ backgroundColor: theme.accent }} />
        {/* The renderer's own footer line, not a copy of it: a preview that
            can drift from the card is worse than no preview. */}
        <div className="mt-1 text-xs" style={{ color: theme.secondary }}>
          {roomCardMark(handle)}
        </div>
      </div>

      {lifted ? (
        <p className="text-xs text-secondary">
          That colour is too dark to read on a share card, so cards use a lighter version of it —
          the one above.
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-outline text-sm"
          disabled={busy || unchanged || !normalized}
          onClick={() => void save(normalized ?? '')}
        >
          {busy ? 'Saving…' : 'Save colour'}
        </button>
        {current ? (
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={busy}
            onClick={() => {
              setAccent(AWF_THEME.accent);
              void save('');
            }}
          >
            Use the default
          </button>
        ) : null}
      </div>
      {error ? <p className="text-accent">{error}</p> : null}
    </div>
  );
}
