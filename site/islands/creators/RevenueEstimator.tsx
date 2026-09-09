import { useMemo, useState } from 'react';
import {
  CREATOR_TIERS,
  estimateRevenue,
  formatCount,
  formatMoney,
} from '@/lib/creators/estimateRevenue';

export default function RevenueEstimator() {
  const [followers, setFollowers] = useState(8000);
  const [missions, setMissions] = useState(1);
  const [joins, setJoins] = useState(20);
  const [userTier, setUserTier] = useState<number | null>(null);
  const [showMath, setShowMath] = useState(false);

  const result = useMemo(
    () => estimateRevenue({ missionsPerWeek: missions, athletesPerRoom: joins }),
    [missions, joins]
  );

  const tierIndex = userTier ?? result.autoTierIndex;
  const tier = CREATOR_TIERS[tierIndex]!;

  return (
    <>
      <div className="creators-estimator">
        <div className="creators-controls">
          <label>
            <span className="creators-lbl">Followers who'd see a post</span>
            <output>{formatCount(followers)}</output>
            <input
              type="range"
              min={500}
              max={100000}
              step={500}
              value={followers}
              onChange={(e) => setFollowers(Number(e.target.value))}
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
              min={5}
              max={150}
              step={5}
              value={joins}
              onChange={(e) => setJoins(Number(e.target.value))}
            />
          </label>
          <p className="creators-fine">
            Rooms of 15–30 are typical for 5k–20k followers with a weekly slot. Set it to what you'd
            actually get.
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
                Athletes per month = rooms × 4.3 × athletes. 20% of guests save the mission to an
                account. 7% of those go paid within 60 days. Average net per subscription is about
                $50 after the athlete's 15% squad discount and card fees (most pick the 12-month
                plan). You earn your tier's share of that in year one, and a renewal share after.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <h3>Your share grows with your squad</h3>
      <div className="creators-tiers" role="tablist" aria-label="Revenue share tiers">
        {CREATOR_TIERS.map((t, i) => (
          <button
            key={t.name}
            role="tab"
            type="button"
            className={`creators-tier${tierIndex === i ? 'is-active' : ''}`}
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
        Attribution works two ways: your link or code at signup, or an athlete joining your room and
        choosing to train with you when they save the mission. You see clicks, joins, saves and paid
        conversions on one dashboard. Payouts through Stripe on the 15th of each month; $25 minimum.
      </p>
    </>
  );
}
