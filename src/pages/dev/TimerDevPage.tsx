import { useAmrapTimer } from '@/hooks/useAmrapTimer';

const DEV_SETUP_SEC = 5;
const DEV_WORK_SEC = 60;

export default function TimerDevPage() {
  const timer = useAmrapTimer();

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">AMRAP Timer Dev</h1>

      <section className="space-y-2 rounded border border-gray-300 p-4">
        <p>Phase: {timer.phase}</p>
        <p>Time left: {timer.timeLeftSec}s</p>
        <p>Elapsed: {timer.elapsedSec}s</p>
        <p>Rounds: {timer.rounds.length}</p>
        <p>Paused: {timer.isPaused ? 'yes' : 'no'}</p>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-gray-900 px-3 py-2 text-white"
          onClick={() =>
            timer.start({
              setupDurationSec: DEV_SETUP_SEC,
              workDurationSec: DEV_WORK_SEC,
            })
          }
        >
          Start ({DEV_SETUP_SEC}s setup / {DEV_WORK_SEC}s work)
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={timer.pause}
        >
          Pause
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={timer.resume}
        >
          Resume
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={timer.logRound}
        >
          Log round
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={timer.finish}
        >
          Finish
        </button>
      </section>

      {timer.rounds.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Logged rounds</h2>
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
