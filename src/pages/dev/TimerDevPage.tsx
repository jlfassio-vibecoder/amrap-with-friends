import { useAmrapTimer } from '@/hooks/useAmrapTimer';

const DEV_SETUP_SEC = 5;
const DEV_WORK_SEC = 60;

export default function TimerDevPage() {
  const timer = useAmrapTimer();

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-display text-xl text-ink">AMRAP Timer Dev</h1>

      <section className="card space-y-2 p-4">
        <p>Phase: {timer.phase}</p>
        <p>Time left: {timer.timeLeftSec}s</p>
        <p>Elapsed: {timer.elapsedSec}s</p>
        <p>Rounds: {timer.rounds.length}</p>
        <p>Paused: {timer.isPaused ? 'yes' : 'no'}</p>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-neutral"
          onClick={() =>
            timer.start({
              setupDurationSec: DEV_SETUP_SEC,
              workDurationSec: DEV_WORK_SEC,
            })
          }
        >
          Start ({DEV_SETUP_SEC}s setup / {DEV_WORK_SEC}s work)
        </button>
        <button type="button" className="btn-outline" onClick={timer.pause}>
          Pause
        </button>
        <button type="button" className="btn-outline" onClick={timer.resume}>
          Resume
        </button>
        <button type="button" className="btn-outline" onClick={timer.logRound}>
          Log round
        </button>
        <button type="button" className="btn-outline" onClick={timer.finish}>
          Finish
        </button>
      </section>

      {timer.rounds.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium text-ink">Logged rounds</h2>
          <ul className="space-y-1 text-sm">
            {timer.rounds.map((round) => (
              <li key={round.roundIndex}>
                Round {round.roundIndex + 1}: {round.elapsedSecAtRound}s elapsed
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
