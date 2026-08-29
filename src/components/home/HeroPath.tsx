function SquadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 text-accent"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function BearingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 text-accent"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M16.2 7.8l-2.3 6-6 2.3 2.3-6z" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 text-accent"
      aria-hidden
    >
      <path d="M3 17l5.5-5.5 3.5 3.5L21 6" />
      <path d="M15 6h6v6" />
    </svg>
  );
}

const STEPS = [
  {
    num: '01 / Assemble',
    Icon: SquadIcon,
    title: 'Call your squad',
    body: 'Start with the people who make you show up. Send one rally link — your crew joins from any device, and nobody needs an account to jump in.',
    footnote: 'One link · one crew',
  },
  {
    num: '02 / Set the bearing',
    Icon: BearingIcon,
    title: 'Choose the mission',
    body: 'Pick a workout and a time domain. Everyone sees the same objective, the same clock, and the same direction before the countdown starts.',
    footnote: 'Clear objective · shared clock',
  },
  {
    num: '03 / Earn the title',
    Icon: LaunchIcon,
    title: 'Launch the rally',
    body: 'Train live. Log rounds with a tap. Watch the crew advance together and finish with a score that counted for more than yourself.',
    footnote: 'Live effort · real belonging',
  },
] as const;

export function HeroPath() {
  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="eyebrow text-accent">The path</p>
          <h2 className="text-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.9] text-ink">
            From “someday” to send it.
          </h2>
        </div>
        <p className="max-w-[22rem] text-sm leading-[1.6] text-secondary">
          A short, deliberate funnel built around the one thing that matters: getting your people
          moving together — fast.
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-card border border-border bg-divider md:grid-cols-3">
        {STEPS.map(({ num, Icon, title, body, footnote }) => (
          <article key={title} className="flex flex-col bg-surface p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">{num}</p>
            <span className="mb-5 mt-7 block">
              <Icon />
            </span>
            <h3 className="text-display text-2xl text-ink">{title}</h3>
            <p className="mt-3 text-sm leading-[1.6] text-secondary">{body}</p>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.13em] text-accent md:mt-auto md:pt-6">
              {footnote}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
