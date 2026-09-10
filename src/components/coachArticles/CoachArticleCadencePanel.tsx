import { useMemo } from 'react';
import type { CoachArticleSummary } from '@/lib/api/coachArticles';
import {
  ARTICLE_STARTERS,
  REFRESH_STALE_MONTHS,
  initialDraftFromStarter,
  matchStarterToArticles,
  monthlyCadenceCounts,
  nextStartersToWrite,
  stalePublishedArticles,
  type ArticleInitialDraft,
} from '@/lib/coach/articles/articleStarters';

interface CoachArticleCadencePanelProps {
  articles: CoachArticleSummary[];
  loading: boolean;
  error: string | null;
  onStartDraft: (draft: ArticleInitialDraft) => void;
  onOpenArticle: (summary: CoachArticleSummary) => void;
}

export function CoachArticleCadencePanel({
  articles,
  loading,
  error,
  onStartDraft,
  onOpenArticle,
}: CoachArticleCadencePanelProps) {
  const matches = useMemo(() => matchStarterToArticles(ARTICLE_STARTERS, articles), [articles]);
  const writeNext = useMemo(() => nextStartersToWrite(matches), [matches]);
  const counts = useMemo(() => monthlyCadenceCounts(articles), [articles]);
  const refreshQueue = useMemo(() => stalePublishedArticles(articles), [articles]);
  const startedCount = matches.filter((m) => m.article !== null).length;

  return (
    <section className="card space-y-5 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">Cadence</h2>
        <p className="text-sm text-secondary">
          What to write or refresh next — from the blog-authoring calendar ({startedCount}/
          {ARTICLE_STARTERS.length} starters started).
        </p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading cadence…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-secondary">
            <p>
              <span className="font-semibold text-ink">{counts.publishedThisMonth}</span> published
              this month
            </p>
            <p>
              <span className="font-semibold text-ink">{counts.refreshesThisMonth}</span> refreshes
              this month
            </p>
            <p className="text-muted">Refresh due after {REFRESH_STALE_MONTHS} months</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Write next</h3>
            {writeNext.length === 0 ? (
              <p className="text-sm text-muted">
                All calendar starters have a draft or published post.
              </p>
            ) : (
              <ul className="space-y-2">
                {writeNext.map(({ starter }) => (
                  <li
                    key={starter.id}
                    className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-ink">
                        {starter.id}. {starter.title}
                      </p>
                      <p className="text-xs text-muted">{starter.angleHint}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        {starter.seasonal ? <span>Seasonal</span> : null}
                        {starter.trainingTogetherWedge ? (
                          <span className="text-accent">Training together (wedge)</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-outline shrink-0 text-xs"
                      onClick={() => onStartDraft(initialDraftFromStarter(starter))}
                    >
                      Start draft
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Refresh queue</h3>
            {refreshQueue.length === 0 ? (
              <p className="text-sm text-muted">Nothing due for refresh.</p>
            ) : (
              <ul className="space-y-2">
                {refreshQueue.map((article) => (
                  <li
                    key={article.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
                  >
                    <p className="text-sm text-ink">{article.title}</p>
                    <button
                      type="button"
                      className="btn-outline shrink-0 text-xs"
                      onClick={() => onOpenArticle(article)}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
