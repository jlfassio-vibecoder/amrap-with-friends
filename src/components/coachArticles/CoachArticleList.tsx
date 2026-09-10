import { useMemo, useState } from 'react';
import type { CoachArticleSummary } from '@/lib/api/coachArticles';
import { ARTICLE_CATEGORIES } from '@/lib/coach/articles/taxonomy';

const STATUS_FILTERS = [
  { id: '', label: 'All statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'ready', label: 'Ready' },
  { id: 'published', label: 'Published' },
] as const;

interface CoachArticleListProps {
  articles: CoachArticleSummary[];
  loading: boolean;
  error: string | null;
  onSelect: (article: CoachArticleSummary) => void;
  onCreateNew: () => void;
}

export function CoachArticleList({
  articles,
  loading,
  error,
  onSelect,
  onCreateNew,
}: CoachArticleListProps) {
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      if (statusFilter && article.status !== statusFilter) {
        return false;
      }
      if (categoryFilter && article.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [articles, statusFilter, categoryFilter]);

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Posts</h2>
        <button type="button" className="btn-primary text-sm" onClick={onCreateNew}>
          New post
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id || 'all-status'}
            type="button"
            className={statusFilter === filter.id ? 'btn-primary text-xs' : 'btn-outline text-xs'}
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={categoryFilter === '' ? 'btn-primary text-xs' : 'btn-outline text-xs'}
          onClick={() => setCategoryFilter('')}
        >
          All categories
        </button>
        {ARTICLE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={
              categoryFilter === category.id ? 'btn-primary text-xs' : 'btn-outline text-xs'
            }
            onClick={() => setCategoryFilter(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-secondary">Loading posts…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="text-sm text-secondary">No posts match these filters.</p>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <ul className="divide-y divide-divider">
          {filtered.map((article) => (
            <li key={article.id} className="py-3">
              <button
                type="button"
                className="w-full min-w-0 text-left"
                onClick={() => onSelect(article)}
              >
                <p className="truncate text-sm font-semibold text-ink hover:text-accent hover:underline">
                  {article.title || '(Untitled)'}
                  <span
                    className={
                      article.status === 'published'
                        ? 'ml-2 rounded-card bg-success-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-text'
                        : article.status === 'ready'
                          ? 'ml-2 rounded-card bg-accent-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent'
                          : 'ml-2 rounded-card border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary'
                    }
                  >
                    {article.status}
                  </span>
                </p>
                <p className="text-xs text-secondary">
                  /{article.slug || '…'}
                  {article.category ? ` · ${article.category}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
