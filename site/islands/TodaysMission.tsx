import { FeaturedWodCard } from '@/components/home/FeaturedWodCard';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import { HomeIsland } from './HomeIsland';

/** Today's mission fetches for everyone; the campaigns panel is signed-in only. */
export default function TodaysMission() {
  return (
    <HomeIsland>
      <div className="space-y-16">
        <FeaturedWodCard />
        <MyCampaignsPanel />
      </div>
    </HomeIsland>
  );
}
