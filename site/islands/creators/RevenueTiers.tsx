import { useState } from 'react';
import { CREATOR_TIERS } from '@/lib/creators/estimateRevenue';

/**
 * Tier ladder for the creators revenue chapter — tabs only, no earnings estimator.
 */
export default function RevenueTiers() {
  const [tierIndex, setTierIndex] = useState(0);
  const tier = CREATOR_TIERS[tierIndex]!;

  return (
    <>
      <div className="creators-tiers" role="tablist" aria-label="Revenue share tiers">
        {CREATOR_TIERS.map((t, i) => (
          <button
            key={t.name}
            role="tab"
            type="button"
            className={`creators-tier${tierIndex === i ? 'is-active' : ''}`}
            aria-selected={tierIndex === i}
            tabIndex={tierIndex === i ? 0 : -1}
            onClick={() => setTierIndex(i)}
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
