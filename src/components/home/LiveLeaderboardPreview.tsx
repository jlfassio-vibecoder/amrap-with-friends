import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** Illustrative roster — labelled preview of the mission view, not live data. */
const ROSTER = [
  { rank: 1, name: 'Maya', reps: 184, online: true },
  { rank: 2, name: 'Jules', reps: 161, online: true },
  { rank: 3, name: 'Rico', reps: 138, online: true },
  { rank: 4, name: 'Sam', reps: 138, online: false },
] as const;

const PREVIEW_START_SEC = 462;
const PREVIEW_LOOP_SEC = 600;
const PREVIEW_DURATION_SEC = 600;

function formatTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Counts the preview clock down and loops it, so the card reads as a mission
 * in progress rather than a screenshot. */
function usePreviewClock() {
  const [remainingSec, setRemainingSec] = useState(PREVIEW_START_SEC);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : PREVIEW_LOOP_SEC));
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return remainingSec;
}

export function LiveLeaderboardPreview() {
  const remainingSec = usePreviewClock();
  const elapsedSec = PREVIEW_DURATION_SEC - remainingSec;
  const onlineCount = ROSTER.filter((entry) => entry.online).length;

  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <div className="space-y-5">
        <p className="eyebrow text-accent">Live leaderboard</p>
        <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
          The clock is shared. The effort is visible.
        </h2>
        <p className="max-w-[26rem] text-base leading-[1.7] text-secondary">
          Everyone enters the same timed mission on a countdown that&apos;s reconciled in real time.
          Rep counts update together, turning a personal effort into a mission the whole crew can
          feel — whether they&apos;re across the gym or across time zones.
        </p>
        <Link className="btn-primary inline-block" to="/create">
          {/* Copilot suggestion ignored: keep user-specified “Start a Mission” CTA on this marketing surface. */}
          Start a Mission
        </Link>
      </div>

      <figure className="m-0 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Emulates the waiting-room status / clock block. */}
          <div className="card flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-display text-xs uppercase tracking-widest text-secondary">Live</p>
            <p className="text-display text-5xl tabular-nums text-accent lg:text-6xl">
              {formatTime(remainingSec)}
            </p>
            <p className="text-sm text-secondary">Elapsed: {formatTime(elapsedSec)}</p>
            <p className="text-xs text-muted">
              Realtime:{' '}
              <span
                className="font-semibold text-success-text"
                style={{
                  textShadow: '0 0 8px color-mix(in srgb, var(--color-success) 45%, transparent)',
                }}
              >
                connected
              </span>
            </p>
          </div>

          {/* Emulates ParticipantsPanel roster density and scoring. */}
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-display text-sm text-ink lg:text-base">Participants</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-page px-2.5 py-1 text-[11px] font-semibold text-success-text">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                {onlineCount} here
              </span>
            </div>

            <ul className="list-none space-y-1" role="list">
              {ROSTER.map(({ rank, name, reps, online }) => (
                <li key={name} className="flex items-center gap-2 px-2 py-1.5" role="listitem">
                  <span
                    className={
                      rank === 1
                        ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-accent'
                        : 'inline-flex h-7 w-7 shrink-0 items-center justify-center text-sm font-medium tabular-nums text-muted'
                    }
                  >
                    {rank}
                  </span>
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-muted'}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {reps} reps
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <figcaption className="text-xs text-muted">
          Example mission view — not live data.
        </figcaption>
      </figure>
    </section>
  );
}
