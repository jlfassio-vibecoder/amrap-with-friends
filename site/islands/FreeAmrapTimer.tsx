import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatClock } from '@/lib/amrapTimer/formatClock';
import {
  reportFreeTimerAbandoned,
  reportFreeTimerCompleted,
  reportFreeTimerCtaClicked,
  reportFreeTimerStarted,
  shouldReportFreeTimerAbandon,
} from '@/lib/analytics/freeTimerEvents';

const DURATIONS = [5, 10, 15, 20] as const;

/** Deadline-based, so a backgrounded tab that stops firing intervals still shows the right time. */
function useCountdown(durationMinutes: number) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      setRemaining(durationMinutes * 60);
    }
    // Changing the duration while stopped resets the clock; while running it is ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMinutes]);

  useEffect(() => {
    if (!running) {
      return;
    }
    deadlineRef.current = Date.now() + remaining * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round(((deadlineRef.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
      }
    }, 200);
    return () => window.clearInterval(id);
    // `remaining` is the starting point for this run, not a dependency: re-running
    // on every tick would reset the deadline each second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(durationMinutes * 60);
  }, [durationMinutes]);

  return { running, remaining, setRunning, reset };
}

/** One short tone. Web Audio only, so the page ships no audio files. */
function useBeep() {
  const contextRef = useRef<AudioContext | null>(null);
  return useCallback((frequency: number, seconds: number) => {
    try {
      contextRef.current ??= new AudioContext();
      const context = contextRef.current;
      void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + seconds);
    } catch {
      /* audio is a nicety; a browser that blocks it should not break the timer */
    }
  }, []);
}

export default function FreeAmrapTimer() {
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [rounds, setRounds] = useState(0);
  const { running, remaining, setRunning, reset } = useCountdown(durationMinutes);
  const beep = useBeep();
  const lastBeepRef = useRef<number | null>(null);
  // Refs, not state: the unload handler is registered once and would otherwise
  // close over the counts as they were at mount.
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const runRef = useRef({ durationMinutes, rounds, timeLeftSec: remaining });

  // Declared before every effect that reads it: effects run in order, so the
  // completion and abandon handlers below always see the current run rather
  // than the previous render's.
  useEffect(() => {
    runRef.current = { durationMinutes, rounds, timeLeftSec: remaining };
  }, [durationMinutes, rounds, remaining]);

  useEffect(() => {
    if (!running || lastBeepRef.current === remaining) {
      return;
    }
    lastBeepRef.current = remaining;
    if (remaining > 0 && remaining <= 3) {
      beep(880, 0.15);
    }
  }, [remaining, running, beep]);

  useEffect(() => {
    if (remaining === 0 && lastBeepRef.current !== 0) {
      lastBeepRef.current = 0;
      beep(440, 0.8);
    }
  }, [remaining, beep]);

  // A run that reached zero is finished whether or not they are still looking
  // at the page, so it reports here rather than on unload.
  useEffect(() => {
    if (remaining === 0 && startedRef.current && !completedRef.current) {
      completedRef.current = true;
      reportFreeTimerCompleted(runRef.current);
    }
  }, [remaining]);

  // Leaving mid-run is the interesting failure, and a normal request does not
  // survive the unload — hence the beacon path inside sendContentEvent.
  useEffect(() => {
    function reportIfMidRun() {
      if (
        !shouldReportFreeTimerAbandon({
          started: startedRef.current,
          finished: completedRef.current,
        })
      ) {
        return;
      }
      completedRef.current = true;
      reportFreeTimerAbandoned(runRef.current);
    }

    window.addEventListener('pagehide', reportIfMidRun);
    return () => {
      window.removeEventListener('pagehide', reportIfMidRun);
    };
  }, []);

  const finished = remaining === 0;
  const label = useMemo(() => formatClock(remaining), [remaining]);

  return (
    <div className="card space-y-6 p-6 sm:p-8">
      <div>
        <p className="eyebrow text-accent">Time domain</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DURATIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={durationMinutes === minutes}
              disabled={running}
              onClick={() => setDurationMinutes(minutes)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
                durationMinutes === minutes
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface text-secondary hover:text-ink'
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>

      <div
        className="text-display text-center text-[clamp(4rem,18vw,9rem)] tabular-nums leading-none text-ink"
        role="timer"
        aria-live="off"
      >
        {label}
      </div>
      <p className="sr-only" aria-live="polite">
        {finished ? 'Time is up.' : `${label} remaining, ${rounds} rounds logged.`}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!running) {
              beep(660, 0.12);
              if (!startedRef.current) {
                startedRef.current = true;
                reportFreeTimerStarted(durationMinutes);
              }
            }
            setRunning(!running);
          }}
          disabled={finished}
          className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-40"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          onClick={() => setRounds((count) => count + 1)}
          disabled={!running}
          className="rounded-card border border-border bg-surface px-6 py-3.5 font-semibold text-ink disabled:opacity-40"
        >
          Log round
        </button>
        <button
          type="button"
          onClick={() => {
            // A reset ends this run for reporting: the next Start is a new one.
            if (
              shouldReportFreeTimerAbandon({
                started: startedRef.current,
                finished: completedRef.current,
              })
            ) {
              reportFreeTimerAbandoned(runRef.current);
            }
            startedRef.current = false;
            completedRef.current = false;
            reset();
            setRounds(0);
            lastBeepRef.current = null;
          }}
          className="rounded-card border border-border bg-surface px-6 py-3.5 font-semibold text-secondary hover:text-ink"
        >
          Reset
        </button>
      </div>

      <p className="text-center text-sm text-secondary">
        Rounds completed: <strong className="text-display text-2xl text-ink">{rounds}</strong>
      </p>

      {/* The page had no way into the product at all. This is the moment of
          most intent — they have just done the thing the app is for — so the
          copy after a finished run names what they would get by doing it with
          other people, rather than asking them to sign up for its own sake. */}
      <div className="space-y-2 border-t border-border pt-5 text-center">
        <p className="text-sm text-secondary">
          {finished
            ? `${rounds} rounds in ${durationMinutes} minutes. Run the same clock with friends and see everyone's rounds land live.`
            : 'This timer is the solo version. The app runs one synced clock across everyone’s phones, with a shared leaderboard.'}
        </p>
        <a
          className="btn-primary inline-flex items-center justify-center text-sm"
          href="/plan-mission"
          onClick={() => {
            reportFreeTimerCtaClicked(finished ? 'finished' : 'idle', runRef.current);
          }}
        >
          {finished ? 'Do this one with friends' : 'Plan a mission'}
        </a>
      </div>
    </div>
  );
}
