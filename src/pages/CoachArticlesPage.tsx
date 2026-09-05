import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CoachArticleForm } from '@/components/coachArticles/CoachArticleForm';
import { CoachArticleList } from '@/components/coachArticles/CoachArticleList';
import {
  fetchCoachArticle,
  type CoachArticle,
  type CoachArticleSummary,
} from '@/lib/api/coachArticles';

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; article: CoachArticle };

export default function CoachArticlesPage() {
  const [view, setView] = useState<View>({ mode: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleSelect(summary: CoachArticleSummary) {
    setLoadError(null);
    const result = await fetchCoachArticle(summary.id);
    if (result.error || !result.data) {
      setLoadError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setFormKey((k) => k + 1);
    setView({ mode: 'edit', article: result.data });
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
    setView({ mode: 'list' });
  }

  function handleStatusChanged(article: CoachArticle) {
    setRefreshKey((k) => k + 1);
    setView({ mode: 'edit', article });
  }

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="Article Builder" subtitle="Coach blog drafts" />

      <div className="mx-auto max-w-4xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        {loadError ? <p className="text-error text-sm">{loadError}</p> : null}

        {view.mode === 'list' ? (
          <CoachArticleList
            refreshKey={refreshKey}
            onSelect={(summary) => {
              void handleSelect(summary);
            }}
            onCreateNew={() => {
              setFormKey((k) => k + 1);
              setView({ mode: 'new' });
            }}
          />
        ) : (
          <CoachArticleForm
            key={formKey}
            article={view.mode === 'edit' ? view.article : null}
            onSaved={handleSaved}
            onStatusChanged={handleStatusChanged}
            onCancel={() => setView({ mode: 'list' })}
          />
        )}

        <p className="flex justify-center">
          <Link className="link-accent text-sm" to="/coach">
            Back to Coach dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
