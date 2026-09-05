import { useState, type FormEvent } from 'react';
import {
  setCoachArticleStatus,
  upsertCoachArticle,
  type CoachArticle,
} from '@/lib/api/coachArticles';
import { ARTICLE_ARCHETYPES, ARTICLE_CATEGORIES } from '@/lib/coach/articles/taxonomy';
import { articlePillarPaths } from '@/lib/coach/articles/pillarPaths';
import { isValidArticleSlug, slugifyArticleTitle } from '@/lib/coach/articles/slugify';
import { softValidateArticle } from '@/lib/coach/articles/validateArticle';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { callsignFromEmail } from '@/lib/missionIdentity';

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function defaultAuthorName(email: string | null | undefined): string {
  return callsignFromEmail(email) ?? '';
}

interface CoachArticleFormProps {
  article?: CoachArticle | null;
  onSaved: (article: CoachArticle) => void;
  onStatusChanged?: (article: CoachArticle) => void;
  onCancel: () => void;
}

export function CoachArticleForm({
  article,
  onSaved,
  onStatusChanged,
  onCancel,
}: CoachArticleFormProps) {
  const { user } = useAmrapAuth();
  const pillars = articlePillarPaths();

  const [articleId, setArticleId] = useState(article?.id);
  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [slugDirty, setSlugDirty] = useState(Boolean(article?.slug));
  const [category, setCategory] = useState(article?.category ?? '');
  const [archetype, setArchetype] = useState(article?.archetype ?? '');
  const [authorDisplayName, setAuthorDisplayName] = useState(
    article?.authorDisplayName || defaultAuthorName(user?.email)
  );
  const [answerFirst, setAnswerFirst] = useState(article?.answerFirst ?? '');
  const [description, setDescription] = useState(article?.description ?? '');
  const [bodyMarkdown, setBodyMarkdown] = useState(article?.bodyMarkdown ?? '');
  const [pillarPath, setPillarPath] = useState(article?.pillarPath ?? '');
  const [cannibalisationNote, setCannibalisationNote] = useState(
    article?.cannibalisationNote ?? ''
  );
  const [libraryLinks, setLibraryLinks] = useState<string[]>(
    article?.libraryLinks?.length ? article.libraryLinks : ['', '']
  );
  const [relatedPostSlugs, setRelatedPostSlugs] = useState(
    (article?.relatedPostSlugs ?? []).join(', ')
  );
  const [status, setStatus] = useState(article?.status ?? 'draft');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildInput() {
    return {
      id: articleId,
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      category,
      archetype,
      answerFirst,
      description,
      bodyMarkdown,
      authorDisplayName: authorDisplayName.trim(),
      pillarPath,
      cannibalisationNote,
      libraryLinks: libraryLinks.map((l) => l.trim()).filter(Boolean),
      relatedPostSlugs: relatedPostSlugs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async function saveDraft() {
    setError(null);
    const input = buildInput();
    if (!input.title) {
      setError('Title is required.');
      return null;
    }
    if (!input.slug) {
      setError('Slug is required.');
      return null;
    }
    if (!isValidArticleSlug(input.slug)) {
      setError('Slug must be lowercase kebab-case.');
      return null;
    }

    setSubmitting(true);
    const result = await upsertCoachArticle(input);
    setSubmitting(false);

    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return null;
    }

    setArticleId(result.data.id);
    setStatus(result.data.status);
    return result.data;
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWarnings([]);
    const saved = await saveDraft();
    if (saved) {
      onSaved(saved);
    }
  }

  async function handleMarkReady() {
    setError(null);
    const input = buildInput();
    const softIssues = softValidateArticle({
      title: input.title,
      slug: input.slug,
      category: input.category,
      archetype: input.archetype,
      answerFirst: input.answerFirst,
      description: input.description,
      authorDisplayName: input.authorDisplayName,
      pillarPath: input.pillarPath,
      cannibalisationNote: input.cannibalisationNote,
      libraryLinks: input.libraryLinks,
    });
    setWarnings(softIssues.map((issue) => issue.message));

    const saved = await saveDraft();
    if (!saved) {
      return;
    }

    setSubmitting(true);
    const result = await setCoachArticleStatus(saved.id, 'ready');
    setSubmitting(false);

    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    setStatus(result.data.status);
    onStatusChanged?.(result.data);
  }

  async function handleReturnToDraft() {
    if (!articleId) {
      return;
    }
    setError(null);
    setWarnings([]);
    setSubmitting(true);
    const result = await setCoachArticleStatus(articleId, 'draft');
    setSubmitting(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setStatus(result.data.status);
    onStatusChanged?.(result.data);
  }

  return (
    <form className="card space-y-4 p-4" onSubmit={handleSaveDraft}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          {article ? 'Edit post' : 'New post'}
        </h3>
        <span
          className={
            status === 'ready'
              ? 'rounded-card bg-success-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-text'
              : 'rounded-card border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary'
          }
        >
          {status}
        </span>
      </div>

      {error ? <p className="text-error text-sm">{error}</p> : null}
      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-card border border-border bg-page p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Soft warnings (ready still allowed)
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-secondary">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Title
          </span>
          <input
            type="text"
            className="input-field"
            value={title}
            maxLength={200}
            onChange={(event) => {
              const next = event.target.value;
              setTitle(next);
              if (!slugDirty) {
                setSlug(slugifyArticleTitle(next));
              }
            }}
            placeholder="Post title"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">Slug</span>
          <input
            type="text"
            className="input-field font-mono text-sm"
            value={slug}
            maxLength={120}
            onChange={(event) => {
              setSlugDirty(true);
              setSlug(event.target.value);
            }}
            placeholder="kebab-case-slug"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Author
          </span>
          <input
            type="text"
            className="input-field"
            value={authorDisplayName}
            maxLength={120}
            onChange={(event) => setAuthorDisplayName(event.target.value)}
            placeholder="Display name"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Category
          </span>
          <select
            className="input-field"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Select…</option>
            {ARTICLE_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Archetype
          </span>
          <select
            className="input-field"
            value={archetype}
            onChange={(event) => setArchetype(event.target.value)}
          >
            <option value="">Select…</option>
            {ARTICLE_ARCHETYPES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Answer-first ({wordCount(answerFirst)} words · aim 40–60)
        </span>
        <textarea
          className="input-field min-h-24"
          value={answerFirst}
          maxLength={2000}
          onChange={(event) => setAnswerFirst(event.target.value)}
          placeholder="Lead with the answer in plain English."
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Meta description ({description.trim().length} / 50–160)
        </span>
        <textarea
          className="input-field min-h-16"
          value={description}
          maxLength={320}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Body (Markdown)
        </span>
        <textarea
          className="input-field min-h-48 font-mono text-sm"
          value={bodyMarkdown}
          maxLength={100000}
          onChange={(event) => setBodyMarkdown(event.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Pillar path
        </span>
        <select
          className="input-field"
          value={pillarPath}
          onChange={(event) => setPillarPath(event.target.value)}
        >
          <option value="">Select…</option>
          {pillars.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Why not a page edit
        </span>
        <textarea
          className="input-field min-h-16"
          value={cannibalisationNote}
          maxLength={1000}
          onChange={(event) => setCannibalisationNote(event.target.value)}
          placeholder="This would make an existing page worse if merged into it because…"
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Library links
        </span>
        {libraryLinks.map((link, index) => (
          <div key={`link-${index}`} className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1 font-mono text-sm"
              value={link}
              onChange={(event) => {
                const next = [...libraryLinks];
                next[index] = event.target.value;
                setLibraryLinks(next);
              }}
              placeholder="/exercises/… or /amrap-workouts/…"
            />
            {libraryLinks.length > 1 ? (
              <button
                type="button"
                className="btn-outline text-xs"
                onClick={() => setLibraryLinks(libraryLinks.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="btn-outline text-xs"
          onClick={() => setLibraryLinks([...libraryLinks, ''])}
        >
          Add link
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Related post slugs (optional, comma-separated)
        </span>
        <input
          type="text"
          className="input-field font-mono text-sm"
          value={relatedPostSlugs}
          onChange={(event) => setRelatedPostSlugs(event.target.value)}
          placeholder="other-slug, another-slug"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          className="btn-outline text-sm"
          disabled={submitting}
          onClick={() => {
            void handleMarkReady();
          }}
        >
          Mark ready
        </button>
        {status === 'ready' && articleId ? (
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={submitting}
            onClick={() => {
              void handleReturnToDraft();
            }}
          >
            Return to draft
          </button>
        ) : null}
        <button
          type="button"
          className="btn-outline text-sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Back to list
        </button>
      </div>
    </form>
  );
}
