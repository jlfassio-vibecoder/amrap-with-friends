import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';

export default function CoachArticlesPage() {
  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="Article Builder" subtitle="Coach blog drafts" />

      <div className="mx-auto max-w-4xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        <p className="text-sm text-secondary">
          No drafts yet. Creating and editing posts lands in a later phase.
        </p>

        <p className="flex justify-center">
          <Link className="link-accent text-sm" to="/coach">
            Back to Coach dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
