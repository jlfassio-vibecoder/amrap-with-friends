import { useState, type ReactNode } from 'react';

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'You post a link',
    body: 'Share a rally link to your mission, with its workout and start time.',
  },
  {
    title: 'They tap in as guests',
    body: "First name, that's it. Phone, laptop, TV in the garage — same clock for everyone.",
  },
  {
    title: 'The clock runs, rounds land',
    body: 'Everyone logs rounds on their own device. The board reorders live. You coach the room.',
  },
  {
    title: 'Score lock',
    body: <>At the cap, finish logging your result and save your score. Sharing is optional.</>,
  },
  {
    title: 'Invite them back',
    body: 'Guests can save their result and return for the next mission. Coach-group membership and commission attribution are separate proposed features.',
  },
];

interface Screen {
  title?: string;
  sub?: string;
  input?: string;
  clock?: string;
  btn: string;
  big?: boolean;
}

const SCREENS: Screen[] = [
  {
    title: 'Your mission',
    sub: 'Tue 6:00 pm · 12 min AMRAP',
    btn: 'Join mission',
  },
  {
    title: 'First name',
    input: 'Maya',
    btn: "I'm in",
  },
  {
    clock: '7:42',
    sub: 'Round 4',
    btn: 'Log round',
    big: true,
  },
  {
    clock: '0:00',
    sub: '7 rounds + 12 reps',
    btn: 'I earned this',
  },
  {
    title: 'Save your result',
    sub: 'Keep your progress for next time',
    btn: 'Save result',
  },
];

export default function HostingSteps() {
  const [active, setActive] = useState(0);
  const screen = SCREENS[active]!;

  return (
    <div className="creators-what-grid">
      <div className="creators-steps">
        {STEPS.map((step, i) => (
          <button
            key={step.title}
            className={`creators-step${active === i ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActive(i)}
          >
            <b>{step.title}</b>
            <span>{step.body}</span>
          </button>
        ))}
      </div>
      <div className="creators-step-visual" aria-hidden="true">
        <div className="creators-phone">
          <div className="creators-phone-screen is-active">
            {screen.title ? <span className="creators-ph-title">{screen.title}</span> : null}
            {screen.clock ? <span className="creators-ph-clock">{screen.clock}</span> : null}
            {screen.input ? <span className="creators-ph-input">{screen.input}</span> : null}
            {screen.sub ? <span className="creators-ph-sub">{screen.sub}</span> : null}
            <span className={`creators-ph-btn${screen.big ? ' creators-ph-btn-big' : ''}`}>
              {screen.btn}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
