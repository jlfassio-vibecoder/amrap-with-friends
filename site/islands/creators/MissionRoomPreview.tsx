import { useEffect, useRef, useState } from 'react';

const NAMES = ['Maya', 'Deshawn', 'Priya', 'Tom', 'Ines', 'Kai'] as const;
const FINALS = [8, 7, 7, 6, 6, 5] as const;
const MAX = 9;
const ME_INDEX = 1;

function formatClock(seconds: number): string {
  return `0:${String(seconds).padStart(2, '0')}`;
}

/**
 * Simulated live mission room for the creators recruiting hero.
 * Respects prefers-reduced-motion: snaps to finals and skips the loop.
 *
 * Rows are rendered in score order (not transform-shifted). The paste used
 * translateY((rank - index) * 100%), which ignores grid gap and stacks
 * athletes on top of each other whenever ranks swap.
 */
export default function MissionRoomPreview() {
  const [secondsLeft, setSecondsLeft] = useState(18);
  const [scores, setScores] = useState<number[]>(() => FINALS.map((v) => Math.max(0, v - 3)));
  const [flash, setFlash] = useState<number | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceRef.current) {
      setScores([...FINALS]);
      setSecondsLeft(0);
      setIsFinal(true);
      return;
    }

    let cancelled = false;
    let tickId: number | undefined;
    let restartId: number | undefined;
    let t = 18;
    const state = FINALS.map((v) => Math.max(0, v - 3));

    const paint = () => {
      if (cancelled) return;
      setScores([...state]);
      setSecondsLeft(t);
      setIsFinal(t <= 5);
    };

    const run = () => {
      state.forEach((_, i) => {
        state[i] = Math.max(0, FINALS[i]! - 3);
      });
      t = 18;
      paint();
      tickId = window.setInterval(() => {
        t -= 1;
        state.forEach((_, i) => {
          if (state[i]! < FINALS[i]! && Math.random() < 0.28) {
            state[i]! += 1;
            setFlash(i);
            window.setTimeout(() => setFlash(null), 350);
          }
        });
        paint();
        if (t <= 0) {
          window.clearInterval(tickId);
          FINALS.forEach((v, i) => {
            state[i] = v;
          });
          paint();
          restartId = window.setTimeout(run, 3500);
        }
      }, 1000);
    };

    run();
    return () => {
      cancelled = true;
      if (tickId !== undefined) window.clearInterval(tickId);
      if (restartId !== undefined) window.clearTimeout(restartId);
    };
  }, []);

  // Stable tie-break on original index so equal scores do not flicker.
  const ranked = scores
    .map((score, index) => ({ score, index, name: NAMES[index]! }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return (
    <div className="creators-room" aria-label="A live mission room, simulated">
      <div className="creators-room-head">
        <span className="creators-room-host">
          <span className="creators-avatar">JF</span>@yourhandle
        </span>
        <span className="creators-room-meta">12 min AMRAP</span>
      </div>
      <div className={`creators-clock${isFinal ? ' is-final' : ''}`} aria-live="off">
        {formatClock(secondsLeft)}
      </div>
      <ol className="creators-board">
        {ranked.map(({ score, index, name }) => (
          <li
            key={name}
            className={[index === ME_INDEX ? 'is-me' : '', flash === index ? 'is-flash' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="creators-name">{name}</span>
            <span className="creators-bar">
              <i style={{ width: `${(score / MAX) * 100}%` }} />
            </span>
            <span className="creators-score">{score}</span>
          </li>
        ))}
      </ol>
      <div className="creators-room-foot">
        <span>6 in the room</span>
        <span>Rounds count as they land</span>
      </div>
    </div>
  );
}
