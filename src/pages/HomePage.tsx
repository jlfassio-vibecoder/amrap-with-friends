import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';

function HomePage() {
  return (
    <NarrowPageLayout
      title="AMRAP With Friends"
      subtitle="Train together"
      desktopTitleAsPageHeading
    >
      <div className="flex flex-col items-center gap-6 py-6 text-center lg:py-16">
        <div className="flex flex-wrap justify-center gap-4">
          <Link className="btn-primary" to="/create">
            Create session
          </Link>
          <Link className="btn-outline" to="/join">
            Join session
          </Link>
        </div>
      </div>
    </NarrowPageLayout>
  );
}

export default HomePage;
