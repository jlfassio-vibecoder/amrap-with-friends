import { useEffect, useMemo, useState } from 'react';
import { addSquadFriendToCampaign } from '@/lib/api/campaigns';
import { fetchMySquad, type SquadAthlete } from '@/lib/api/squad';

interface AddSquadFriendToCampaignProps {
  campaignId: string;
  /** Athletes already on the roster — offering them again is a dead end. */
  memberUserIds: string[];
  /** Called after a successful add so the crew list can pick the athlete up. */
  onAdded: () => void;
}

function athleteName(friend: SquadAthlete): string {
  return friend.nickname ?? friend.username ?? 'Athlete';
}

/**
 * Puts a squad friend on the campaign roster without a rally link round trip.
 * Reach is enforced in Postgres against squad_friends; this only offers the
 * people it will accept.
 */
export function AddSquadFriendToCampaign({
  campaignId,
  memberUserIds,
  onAdded,
}: AddSquadFriendToCampaignProps) {
  const [friends, setFriends] = useState<SquadAthlete[]>([]);
  const [loadedSquad, setLoadedSquad] = useState(false);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loadedSquad) {
      return;
    }
    let cancelled = false;
    void fetchMySquad().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.data) {
        setFriends(result.data.friends);
      }
      setLoadedSquad(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loadedSquad]);

  const available = useMemo(
    () => friends.filter((friend) => !memberUserIds.includes(friend.userId)),
    [friends, memberUserIds]
  );

  async function handleAdd() {
    if (!userId) {
      setError('Pick a squad friend to add.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await addSquadFriendToCampaign(campaignId, userId);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const picked = friends.find((friend) => friend.userId === userId);
    setAdded(result.data?.nickname ?? (picked ? athleteName(picked) : 'Your squad friend'));
    setUserId('');
    setOpen(false);
    onAdded();
  }

  if (added) {
    return (
      <p className="text-sm text-secondary">
        {added} is on the campaign now.{' '}
        <button
          type="button"
          className="link-accent"
          onClick={() => {
            setAdded(null);
            setOpen(true);
          }}
        >
          Add another
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-outline text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        Add a squad friend
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-card bg-surface-muted p-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-ink">Add to this campaign</span>
        <select
          className="input-field"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">Pick a squad friend…</option>
          {available.map((friend) => (
            <option key={friend.userId} value={friend.userId}>
              {athleteName(friend)}
            </option>
          ))}
        </select>
      </label>

      {loadedSquad && friends.length === 0 ? (
        <p className="text-xs text-muted">
          Your squad is empty. Add someone on the Squad page first.
        </p>
      ) : null}

      {loadedSquad && friends.length > 0 && available.length === 0 ? (
        <p className="text-xs text-muted">Everyone in your squad is already on this campaign.</p>
      ) : null}

      {error ? <p className="alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy || available.length === 0}
          onClick={() => void handleAdd()}
        >
          {busy ? 'Adding…' : 'Add to campaign'}
        </button>
        <button type="button" className="btn-outline text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
