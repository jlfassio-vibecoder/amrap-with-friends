import { Link } from 'react-router-dom';

const PROOF = [
  { figure: '01 minute', label: 'to launch a rally' },
  { figure: '01 shared clock', label: 'for every athlete' },
  { figure: '∞ reasons', label: 'to show up again' },
] as const;

export function RallyCta() {
  return (
    <section
      id="rally"
      className="night-panel relative isolate overflow-hidden bg-night text-night-ink"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 py-16 lg:px-10 lg:py-24">
        <p className="eyebrow text-gold">Rally command</p>
        <h2 className="landing-headline mt-5 max-w-[45rem] text-[clamp(2.5rem,6vw,4.5rem)] text-night-ink">
          Your next mission begins with one invitation.
        </h2>
        <p className="mt-6 max-w-[32rem] text-base leading-[1.6] text-night-secondary">
          Set up the session in under a minute and share the code. When the timer starts, every
          member of the squad sees the same North Star.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link
            className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            to="/create"
          >
            Create the rally →
          </Link>
          <Link
            className="border-b border-gold pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-night-ink hover:text-gold"
            to="/join"
          >
            I have a session code
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
          {PROOF.map(({ figure, label }) => (
            <div key={figure}>
              <dt className="text-display text-2xl text-night-ink">{figure}</dt>
              <dd className="mt-1 text-xs text-night-secondary">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
