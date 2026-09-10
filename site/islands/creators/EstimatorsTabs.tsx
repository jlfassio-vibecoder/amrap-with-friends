import { useState } from 'react';
import RevenueEstimator from './RevenueEstimator';
import SocialGrowthEstimator from './SocialGrowthEstimator';

const TABS = [
  { id: 'followers', label: 'Followers' },
  { id: 'payments', label: 'Payments' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Bottom-of-page switcher for the main creators calculators — followers growth
 * and payment estimate — without duplicating the tier ladder (already above).
 */
export default function EstimatorsTabs() {
  const [active, setActive] = useState<TabId>('followers');

  return (
    <div className="creators-calcs">
      <div className="creators-tiers" role="tablist" aria-label="Estimators">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            className={`creators-tier${active === tab.id ? 'is-active' : ''}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="creators-calc-panel" role="tabpanel">
        {active === 'followers' ? <SocialGrowthEstimator /> : null}
        {active === 'payments' ? <RevenueEstimator showTiers={false} /> : null}
      </div>
    </div>
  );
}
