import { useEffect, useRef, useState } from 'react';
import { fetchCoachUsersList, type CoachUserListRow } from '@/lib/api/coach';

interface CoachUserPickerProps {
  selectedUser: CoachUserListRow | null;
  onSelect: (user: CoachUserListRow | null) => void;
}

const DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

export function CoachUserPicker({ selectedUser, onSelect }: CoachUserPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachUserListRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function runSearch(search: string) {
    setLoading(true);
    fetchCoachUsersList({ search: search || null, limit: RESULTS_LIMIT }).then((result) => {
      setLoading(false);
      setResults(result.data ?? []);
    });
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setIsOpen(true);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function handleFocus() {
    setIsOpen(true);
    if (results.length === 0 && !loading) {
      runSearch(query);
    }
  }

  function handleBlur() {
    window.setTimeout(() => setIsOpen(false), 150);
  }

  function handlePick(user: CoachUserListRow) {
    onSelect(user);
    setIsOpen(false);
    setQuery('');
  }

  function handleAllUsers() {
    onSelect(null);
    setIsOpen(false);
    setQuery('');
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={selectedUser === null ? 'btn-primary text-sm' : 'btn-outline text-sm'}
          onClick={handleAllUsers}
        >
          All Users
        </button>

        {selectedUser ? (
          <span className="text-sm text-secondary">
            Viewing: <span className="font-semibold text-ink">{selectedUser.nickname}</span> (
            {selectedUser.email})
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          type="text"
          className="input-field text-sm"
          placeholder="Search by username, nickname, or email…"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {isOpen ? (
          <div className="absolute z-10 mt-1 w-full rounded-card border border-border bg-page shadow-lg">
            {loading ? (
              <p className="p-3 text-sm text-secondary">Searching…</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-secondary">No users found.</p>
            ) : (
              <ul>
                {results.map((user) => (
                  <li key={user.userId}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent/10"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handlePick(user)}
                    >
                      <span className="font-semibold text-ink">{user.nickname}</span>{' '}
                      <span className="text-secondary">
                        @{user.username} · {user.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
