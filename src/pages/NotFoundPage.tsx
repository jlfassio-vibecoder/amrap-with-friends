import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';

/**
 * Client-side 404. The edge middleware answers unknown paths with a real 404
 * status before the app ever loads, so this covers the two cases it cannot: a
 * client-side navigation, which never reaches the server, and local dev.
 */
function NotFoundPage() {
  return (
    <NarrowPageLayout title="Page not found" desktopTitleAsPageHeading>
      <p className="text-sm text-secondary">
        That link does not point anywhere. A rally point closes once its mission is done, so an old
        rally link will land here too.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className="link-accent" to="/">
          Back to the home page
        </Link>
        <Link className="link-accent" to="/create">
          Create a mission
        </Link>
      </div>
    </NarrowPageLayout>
  );
}

export default NotFoundPage;
