import { useMemo, useState } from 'react';
import {
  ATHLETES_MAX,
  ATHLETES_MIN,
  ATHLETES_STEP,
  CREATOR_TIERS,
  DEFAULT_ATHLETES,
  DEFAULT_FOLLOWERS,
  FOLLOWERS_MAX,
  FOLLOWERS_MIN,
  FOLLOWERS_STEP,
  athletesFromFollowers,
  estimateRevenue,
  followersFromAthletes,
  formatCount,
  formatMoney,
} from '@/lib/creators/estimateRevenue';

export default function RevenueEstimator({ showTiers = true }: { showTiers?: boolean }) {
  const [followers, setFollowers] = useState(DEFAULT_FOLLOWERS);
  const [missions, setMissions] = useState(1);
  const [joins, setJoins] = useState(DEFAULT_ATHLETES);
  const [userTier, setUserTier] = useState<number | null>(null);
  const [showMath, setShowMath] = useState(false);

  const result = useMemo(
    () => estimateRevenue({ missionsPerWeek: missions, athletesPerRoom: joins }),
    [missions, joins]
  );

  const tierIndex = userTier ?? result.autoTierIndex;
  const tier = CREATOR_TIERS[tierIndex]!;

  function onFollowersChange(next: number) {
    setFollowers(next);
    setJoins(athletesFromFollowers(next));
  }

  function onJoinsChange(next: number) {
    setJoins(next);
    setFollowers(followersFromAthletes(next));
  }

  return (
    <>
      <div className="creators-estimator">
        <div className="creators-controls">
          <label>
            <span className="creators-lbl">Followers who'd see a post</span>
            <output>{formatCount(followers)}</output>
            <input
              type="range"
              min={FOLLOWERS_MIN}
              max={FOLLOWERS_MAX}
              step={FOLLOWERS_STEP}
              value={followers}
              onChange={(e) => onFollowersChange(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="creators-lbl">Missions you host per week</span>
            <output>{missions}</output>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={missions}
              onChange={(e) => setMissions(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="creators-lbl">Athletes in a typical room</span>
            <output>{joins}</output>
            <input
              type="range"
              min={ATHLETES_MIN}
              max={ATHLETES_MAX}
              step={ATHLETES_STEP}
              value={joins}
              onChange={(e) => onJoinsChange(Number(e.target.value))}
            />
          </label>
          <p className="creators-fine">
            Room size tracks reach: about 20 athletes at 8k followers, ~30 at 20k. Drag either
            slider and the other follows. Missions per week stay independent.
          </p>
        </div>
        <div className="creators-results" aria-live="polite">
          <div className="creators-result">
            <span className="creators-r-lbl">Paid subscribers from your rooms, year one</span>
            <span className="creators-r-val">{formatCount(result.paidYear)}</span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">Your earnings, year one</span>
            <span className="creators-r-val creators-r-big">
              {formatMoney(result.yearEarnings)}
            </span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">Monthly by month 12, before renewals</span>
            <span className="creators-r-val">{formatMoney(result.month12Earnings)} / mo</span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">Tier you'd reach</span>
            <span className="creators-r-val">{CREATOR_TIERS[result.autoTierIndex]!.name}</span>
          </div>
          <button className="creators-link" type="button" onClick={() => setShowMath((v) => !v)}>
            {showMath ? 'Hide the math' : 'Show the math'}
          </button>
          {showMath ? (
            <div className="creators-math">
              <p>
                Typical room ≈ 0.22 × √followers (diminishing join rate as the audience grows),
                snapped to the sliders. Athletes per month = rooms × 4.3 × athletes. 20% of guests
                save the mission to an account. 7% of those go paid within 60 days. Average net per
                subscription is about $50 after the athlete's 15% squad discount and card fees (most
                pick the 12-month plan). You earn your tier's share of that in year one, and a
                renewal share after.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {showTiers ? (
        <>
          <h3>Your share grows with your squad</h3>
          <div className="creators-tiers" role="tablist" aria-label="Revenue share tiers">
            {CREATOR_TIERS.map((t, i) => (
              <button
                key={t.name}
                role="tab"
                type="button"
                className={['creators-tier', tierIndex === i ? 'is-active' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-selected={tierIndex === i}
                onClick={() => setUserTier(i)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="creators-tier-panel" role="tabpanel">
            <span className="creators-tp-share">{Math.round(tier.share * 100)}%</span>
            <div className="creators-tp-body">
              <p>{tier.desc}</p>
              <p className="creators-fine">{tier.qual}</p>
            </div>
          </div>
          <p className="creators-fine">
            Proposed attribution works two ways: your link or code at signup, or an athlete joining
            your room and choosing to train with you when they save the mission. A dashboard for
            clicks, joins, saves and paid conversions is planned. Payouts are proposed through
            Stripe on the 15th of each month after paid referrals begin, with a $25 minimum.
          </p>
        </>
      ) : null}
    </>
  );
}
