import { useState } from 'react';

const DAYS = [
  {
    label: 'Sunday',
    title: 'Pick the workout, schedule the room. 10 minutes.',
    body: 'Choose from the library, your own Coach WODs, or write one. Set Tuesday 6pm. Post the link with a Story: "Tuesday. My room. Bring a friend."',
  },
  {
    label: 'Tuesday',
    title: 'Host. 12 minutes on the clock, 30 in the room.',
    body: 'Go live on your usual platform if you like, or just run the room. Call scaling, hype the last minute, hit the cap. Scores lock. Cards go out.',
  },
  {
    label: 'Wednesday',
    title: 'Post the board. 10 minutes.',
    body: 'Share your squad card: top five, plus the age-adjusted winner. Repost the athlete cards that tagged you. Reply to every one.',
  },
  {
    label: 'Friday',
    title: 'Check the dashboard. 5 minutes.',
    body: "Joins, saves, conversions, and what's pending payout. Note who's close to a PR and tell them next week's workout is the same one.",
  },
] as const;

export default function HostingWeekTabs() {
  const [active, setActive] = useState(0);
  const day = DAYS[active]!;

  return (
    <>
      <div className="creators-week" role="tablist" aria-label="Days of a hosting week">
        {DAYS.map((d, i) => (
          <button
            key={d.label}
            role="tab"
            type="button"
            className={['creators-day', active === i ? 'is-active' : ''].filter(Boolean).join(' ')}
            aria-selected={active === i}
            onClick={() => setActive(i)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="creators-day-panels">
        <div className="creators-day-panel is-active" role="tabpanel">
          <b>{day.title}</b>
          <p>{day.body}</p>
        </div>
      </div>
      <div className="creators-kit">
        <h3>Founding hosts are planned to get</h3>
        <ul>
          <li>Coach account free for 12 months (planned standard price $199/yr)</li>
          <li>Builder-tier rates from your first eligible sale once paid referrals launch</li>
          <li>
            A 30-minute setup call and a launch kit: card templates, a 15-second app clip, five
            mission templates
          </li>
          <li>
            Your handle on the founding hosts wall, and a co-post from the AMRAP With Friends
            channels for your first room
          </li>
        </ul>
        <p>
          In return if accepted: one public room a week for eight weeks, and you post the finish.
        </p>
      </div>
    </>
  );
}
