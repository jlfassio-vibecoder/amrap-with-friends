import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useCopyFlash } from '@/hooks/useCopyFlash';
import {
  cancelSquadInvite,
  fetchMySquad,
  removeSquadFriend,
  respondSquadInvite,
  searchAthletes,
  rotateSquadInviteCode,
  sendSquadInvite,
  type MySquad,
  type SquadAthlete,
  type SquadSearchHit,
} from '@/lib/api/squad';
import { buildSquadInviteUrl } from '@/lib/squad';

function displayName(athlete: SquadAthlete): string {
  return athlete.nickname ?? athlete.username ?? 'Athlete';
}

function handleLabel(athlete: SquadAthlete): string | null {
  if (!athlete.username) {
    return null;
  }
  if (athlete.nickname && athlete.nickname !== athlete.username) {
    return `@${athlete.username}`;
  }
  return null;
}

export default function SquadPage() {
  const [squad, setSquad] = useState<MySquad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SquadSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { copied, error: copyError, copy } = useCopyFlash();

  const reload = useCallback(async () => {
    const result = await fetchMySquad();
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      setSquad(null);
      return;
    }
    setError(null);
    setSquad(result.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMySquad().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        setSquad(null);
      } else {
        setError(null);
        setSquad(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    const result = await searchAthletes(query);
    setSearching(false);
    if (result.error) {
      setError(result.error.message);
      setHits([]);
      return;
    }
    setHits(result.data);
  }

  async function handleResetLink() {
    setResetting(true);
    setError(null);
    const result = await rotateSquadInviteCode();
    setResetting(false);
    setConfirmReset(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setSquad((current) => (current ? { ...current, inviteCode: result.data as string } : current));
  }

  async function handleInvite(userId: string) {
    setBusyId(userId);
    const result = await sendSquadInvite(userId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setHits((current) =>
      current.map((hit) => (hit.userId === userId ? { ...hit, status: 'pending_out' } : hit))
    );
    await reload();
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setBusyId(requestId);
    const result = await respondSquadInvite(requestId, accept);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload();
  }

  async function handleCancel(requestId: string) {
    setBusyId(requestId);
    const result = await cancelSquadInvite(requestId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload();
  }

  async function handleRemove(userId: string) {
    setBusyId(userId);
    const result = await removeSquadFriend(userId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload();
  }

  const inviteUrl = squad ? buildSquadInviteUrl(squad.inviteCode, window.location.origin) : '';

  if (loading) {
    return (
      <NarrowPageLayout title="Your squad" contentMaxWidthClassName="max-w-3xl">
        <p className="text-sm text-secondary">Loading your squad…</p>
      </NarrowPageLayout>
    );
  }

  if (!squad) {
    return (
      <NarrowPageLayout title="Your squad" contentMaxWidthClassName="max-w-3xl">
        <p className="text-error">{error ?? 'Something went wrong. Please try again.'}</p>
        <p className="text-center text-sm">
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  return (
    <NarrowPageLayout title="Your squad" contentMaxWidthClassName="max-w-3xl">
      <section className="card space-y-3 p-6">
        <h2 className="text-display text-xl text-ink">Invite someone in</h2>
        <p className="text-sm text-secondary">
          Share this link. After they create an account they can accept and join your squad. For a
          workout tonight, send a rally link from the session instead.
        </p>
        <button
          type="button"
          className="btn-primary text-xs uppercase tracking-widest"
          onClick={() =>
            void copy(inviteUrl, `Could not copy. Share this link manually: ${inviteUrl}`)
          }
        >
          {copied ? 'LINK COPIED' : 'COPY INVITE LINK'}
        </button>
        {copyError ? <p className="text-error text-sm">{copyError}</p> : null}

        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              Reset the link? Anyone still holding the old one will not be able to
              use it. People already on your squad stay.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary"
                disabled={resetting}
                onClick={() => void handleResetLink()}
              >
                {resetting ? 'Resetting…' : 'Yes, reset it'}
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmReset(false)}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm font-semibold text-accent"
            onClick={() => setConfirmReset(true)}
          >
            Reset link
          </button>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-display text-xl text-ink">Find an athlete</h2>
        <form className="flex flex-wrap gap-3" onSubmit={(event) => void handleSearch(event)}>
          <label className="sr-only" htmlFor="squad-search">
            Username or email
          </label>
          <input
            id="squad-search"
            className="input-field flex-1"
            type="search"
            placeholder="Username or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={3}
          />
          <button type="submit" className="btn-primary" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {hits.length === 0 && query.trim().length >= 3 && !searching ? (
          <p className="text-sm text-secondary">No athletes matched that search.</p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="divide-y divide-divider">
            {hits.map((hit) => (
              <li
                key={hit.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-ink">{displayName(hit)}</p>
                  {handleLabel(hit) ? (
                    <p className="text-xs text-muted">{handleLabel(hit)}</p>
                  ) : null}
                </div>
                {hit.status === 'none' ? (
                  <button
                    type="button"
                    className="btn-outline text-sm"
                    disabled={busyId === hit.userId}
                    onClick={() => void handleInvite(hit.userId)}
                  >
                    Invite
                  </button>
                ) : hit.status === 'pending_in' && hit.requestId ? (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === hit.userId}
                    onClick={() => void handleRespond(hit.requestId as string, true)}
                  >
                    Accept
                  </button>
                ) : (
                  <span className="text-xs uppercase tracking-widest text-muted">
                    {hit.status === 'friends'
                      ? 'On your squad'
                      : hit.status === 'pending_out'
                        ? 'Invite sent'
                        : 'Invited you'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {squad.incoming.length > 0 ? (
        <section className="card space-y-4 p-6">
          <h2 className="text-display text-xl text-ink">Invites for you</h2>
          <ul className="divide-y divide-divider">
            {squad.incoming.map((entry) => (
              <li
                key={entry.requestId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <p className="font-semibold text-ink">{displayName(entry)}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === entry.requestId}
                    onClick={() => void handleRespond(entry.requestId, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-outline text-sm"
                    disabled={busyId === entry.requestId}
                    onClick={() => void handleRespond(entry.requestId, false)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {squad.outgoing.length > 0 ? (
        <section className="card space-y-4 p-6">
          <h2 className="text-display text-xl text-ink">Waiting on them</h2>
          <ul className="divide-y divide-divider">
            {squad.outgoing.map((entry) => (
              <li
                key={entry.requestId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <p className="font-semibold text-ink">{displayName(entry)}</p>
                <button
                  type="button"
                  className="text-sm font-semibold text-accent"
                  disabled={busyId === entry.requestId}
                  onClick={() => void handleCancel(entry.requestId)}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-display text-xl text-ink">Your squad</h2>
          <span className="text-xs text-muted">
            {squad.friends.length} of {squad.friendLimit}
          </span>
        </div>
        {squad.friends.length === 0 ? (
          <p className="text-sm text-secondary">
            Nobody is on your squad yet. Search for someone you train with, or copy your invite
            link.
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {squad.friends.map((friend) => (
              <li
                key={friend.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-ink">{displayName(friend)}</p>
                  {handleLabel(friend) ? (
                    <p className="text-xs text-muted">{handleLabel(friend)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-accent"
                  disabled={busyId === friend.userId}
                  onClick={() => void handleRemove(friend.userId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="alert-error">{error}</p> : null}

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
