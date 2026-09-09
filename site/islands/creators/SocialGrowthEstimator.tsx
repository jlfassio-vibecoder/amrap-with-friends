import { useMemo, useState } from 'react';
import {
  ATHLETES_MAX,
  ATHLETES_MIN,
  ATHLETES_STEP,
  DEFAULT_ATHLETES,
  DEFAULT_FOLLOWERS,
  FOLLOWERS_MAX,
  FOLLOWERS_MIN,
  FOLLOWERS_STEP,
  athletesFromFollowers,
  followersFromAthletes,
  formatCount,
} from '@/lib/creators/estimateRevenue';
import {
  CARD_FOLLOW_RATE,
  CARD_POST_RATE,
  LIVE_FOLLOW_RATE,
  LIVE_REACH_RATE,
  VIEWS_PER_CARD_POST,
  estimateSocialGrowth,
  formatFollows,
  formatPercent,
} from '@/lib/creators/estimateSocialGrowth';

export default function SocialGrowthEstimator() {
  const [followers, setFollowers] = useState(DEFAULT_FOLLOWERS);
  const [missions, setMissions] = useState(1);
  const [joins, setJoins] = useState(DEFAULT_ATHLETES);
  const [showMath, setShowMath] = useState(false);

  const result = useMemo(
    () =>
      estimateSocialGrowth({
        followers,
        missionsPerWeek: missions,
        athletesPerRoom: joins,
      }),
    [followers, missions, joins]
  );

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
            <span className="creators-lbl">Followers who'd see a Live</span>
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
            Same reach model as the revenue estimate: room size tracks followers. Missions scale
            both Live views and card posts. Estimate, not a promise.
          </p>
        </div>
        <div className="creators-results" aria-live="polite">
          <div className="creators-result">
            <span className="creators-r-lbl">Live views per week</span>
            <span className="creators-r-val">{formatFollows(result.liveViewersPerWeek)}</span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">Share-card views per week</span>
            <span className="creators-r-val">{formatFollows(result.cardViewsPerWeek)}</span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">New follows per week</span>
            <span className="creators-r-val creators-r-big">
              {formatFollows(result.followsPerWeek)}
            </span>
          </div>
          <div className="creators-result">
            <span className="creators-r-lbl">Year-one follower lift</span>
            <span className="creators-r-val">
              +{formatFollows(result.followsPerYear)}{' '}
              <span className="creators-r-sub">({formatPercent(result.yearLiftRate)})</span>
            </span>
          </div>
          <button className="creators-link" type="button" onClick={() => setShowMath((v) => !v)}>
            {showMath ? 'Hide the math' : 'Show the math'}
          </button>
          {showMath ? (
            <div className="creators-math">
              <p>
                Live viewers = followers × {LIVE_REACH_RATE * 100}% (low end of the common 2–5%
                Instagram Live concurrent band). Of those, {LIVE_FOLLOW_RATE * 100}% follow — the
                floor of healthy Live conversion targets (platforms do not publish an official
                rate). Share cards: {CARD_POST_RATE * 100}% of the room posts, each card gets about{' '}
                {VIEWS_PER_CARD_POST} views (~800 audience × 5% organic reach), and{' '}
                {CARD_FOLLOW_RATE * 100}% of those viewers follow the tagged host. Card rates are
                product assumptions. Weekly totals × 52 for year one.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
