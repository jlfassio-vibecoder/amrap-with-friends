import { Link } from 'react-router-dom';
import { HomeSeoContent } from '@/components/home/HomeSeoContent';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { HostScheduledSessionsPanel } from '@/components/session/HostScheduledSessionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

function HomePage() {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();

  return (
    <NarrowPageLayout
      title="AMRAP With Friends"
      subtitle="Enter the crucible, earn the title."
      hideDesktopTitle
      contentMaxWidthClassName="max-w-[860px]"
      brandWatermark
    >
      <div className="flex flex-col items-center gap-6 py-6 text-center lg:py-16">
        <div className="flex flex-wrap justify-center gap-4">
          {!isAuthLoading && isAuthenticated ? (
            <Link className="btn-primary" to="/hud">
              HUD
            </Link>
          ) : null}
          <Link
            className={!isAuthLoading && isAuthenticated ? 'btn-outline' : 'btn-primary'}
            to="/create"
          >
            Create session
          </Link>
          <Link className="btn-outline" to="/join">
            Join session
          </Link>
        </div>
      </div>
      <HostScheduledSessionsPanel />
      <HomeSeoContent />
    </NarrowPageLayout>
  );
}

export default HomePage;
