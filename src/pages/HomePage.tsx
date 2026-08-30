import { Link } from 'react-router-dom';
import { FeaturedWodCard } from '@/components/home/FeaturedWodCard';
import { HomeSeoContent } from '@/components/home/HomeSeoContent';
import { LandingHero } from '@/components/home/LandingHero';
import { RallyCta } from '@/components/home/RallyCta';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/**
 * Home is the marketing landing page, so it composes its own full-bleed shell
 * (hero and rally band run edge to edge) instead of using NarrowPageLayout,
 * which constrains every child to a single measure. LandingHero carries the
 * page header, since the nav sits on the hero's dark ground.
 */
function HomePage() {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const signedIn = !isAuthLoading && isAuthenticated;

  return (
    <main className="min-h-screen bg-page">
      <LandingHero showHudAction={signedIn} />

      <div className="mx-auto w-full max-w-[1080px] space-y-16 px-6 py-14 lg:px-10 lg:py-20">
        <FeaturedWodCard />
        <MyCampaignsPanel />
        <HomeSeoContent />
      </div>

      <RallyCta />

      <footer className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted lg:px-10">
        <span className="text-display text-lg text-ink">AMRAP With Friends</span>
        <span>Find your North Star. Move as one.</span>
        <Link className="link-accent" to="/coach">
          Coach
        </Link>
      </footer>
    </main>
  );
}

export default HomePage;
