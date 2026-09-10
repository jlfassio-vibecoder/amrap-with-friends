import { useState } from 'react';

const DAYS = [
  {
    label: 'Sunday',
    title: 'Pick the workout, schedule the mission. 10 minutes.',
    body: 'Choose from the library, your own Coach WODs, or write one. Set Tuesday 6pm. Post the link with a Story: "Tuesday. Our next mission. Bring a friend."',
  },
  {
    label: 'Tuesday',
    title: 'Host. 12 minutes on the clock, 30 in the room.',
    body: 'Go live on your usual platform if you like, or just run the room. Call scaling, hype the last minute, hit the cap. Save results. Athletes can choose whether to share.',
  },
  {
    label: 'Wednesday',
    title: 'Share your finish.',
    body: 'Share your own result and invite athletes back. Ask permission before reposting their cards; respect name and score privacy.',
  },
  {
    label: 'Friday',
    title: 'Review who returned.',
    body: 'Review repeat participation with the pilot team and invite your group to the next mission. A commission dashboard is planned, not required for this check-in.',
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
            className={`creators-day${active === i ? ' is-active' : ''}`}
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
        <h3>Planned for accepted Founding Hosts</h3>
        <ul>
          <li>
            Coach access free for 12 months (planned standard price $199.99/year); start date
            confirmed at onboarding
          </li>
          <li>Proposed Builder rates from your first eligible sale once paid referrals launch</li>
          <li>
            A setup call and a launch kit tailored to the pilot: sharing guidance and mission
            templates
          </li>
          <li>
            A planned Founding Host spotlight and a co-post for your first mission, coordinated with
            you
          </li>
        </ul>
        <p>
          In return: one public mission a week for eight weeks, and you share your own finish.
          Athlete sharing stays optional.
        </p>
      </div>
    </>
  );
}
