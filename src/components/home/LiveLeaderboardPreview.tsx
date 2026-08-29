import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** Illustrative roster — this card is a labelled preview of the session view,
 * not live data. */
const ROSTER = [
  { rank: '01', name: 'Maya', rounds: '08', leader: true },
  { rank: '02', name: 'Jules', rounds: '07', leader: false },
  { rank: '03', name: 'Rico', rounds: '06', leader: false },
  { rank: '04', name: 'Sam', rounds: '06', leader: false },
] as const;

const PREVIEW_START_SEC = 462;
const PREVIEW_LOOP_SEC = 600;

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Counts the preview clock down and loops it, so the card reads as a session
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

  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <div className="space-y-5">
        <p className="eyebrow text-accent">Live leaderboard</p>
        <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
          The clock is shared. The effort is visible.
        </h2>
        <p className="max-w-[26rem] text-base leading-[1.7] text-secondary">
          Everyone enters the same timed mission on a countdown that&apos;s reconciled in real time.
          Round counts update together, turning a personal effort into a rally the whole crew can
          feel — whether they&apos;re across the gym or across time zones.
        </p>
        <Link className="btn-primary inline-block" to="/create">
          Start your own rally
        </Link>
      </div>

      <figure className="m-0 space-y-3">
        <div className="overflow-hidden rounded-card border border-night-border bg-navy text-night-ink">
          <div className="flex items-center justify-between border-b border-night-border px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
              Rally / Harbor Watch
            </p>
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-night-secondary">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              Live now
            </span>
          </div>

          <div className="flex items-end justify-between gap-4 bg-deep px-6 py-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.11em] text-night-secondary">
                Engine Room · 10-minute AMRAP
              </p>
              <p className="text-display mt-2 text-2xl text-night-ink">Mission in progress</p>
            </div>
            <p className="text-display text-[clamp(2.5rem,4.5vw,3.75rem)] leading-none text-gold">
              {formatClock(remainingSec)}
            </p>
          </div>

          <ul className="list-none px-6 py-2">
            {ROSTER.map(({ rank, name, rounds, leader }) => (
              <li
                key={name}
                className="flex items-center gap-4 border-b border-night-border py-4 last:border-b-0"
              >
                <span className="text-display w-8 text-lg text-gold">{rank}</span>
                <span className="flex flex-1 items-center gap-2.5 text-sm font-semibold">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${leader ? 'bg-gold' : 'bg-avatar-teal'}`}
                  />
                  {name}
                </span>
                <span className="text-display text-xl text-gold">
                  {rounds}{' '}
                  <span className="text-[9px] font-semibold uppercase tracking-[0.09em] text-night-secondary">
                    rounds
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <figcaption className="text-xs text-muted">
          Example session view — not live data.
        </figcaption>
      </figure>
    </section>
  );
}
