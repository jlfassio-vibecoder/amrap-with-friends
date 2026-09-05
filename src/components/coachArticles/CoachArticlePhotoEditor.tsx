import { useEffect, useMemo } from 'react';
import { getCoachArticleMediaUrl } from '@/lib/media/coachArticleMedia';

export const MAX_ARTICLE_PHOTOS = 20;

export type ArticlePhotoRow =
  | { key: string; kind: 'existing'; path: string; alt: string; caption: string }
  | { key: string; kind: 'pending'; file: File; alt: string; caption: string };

interface CoachArticlePhotoEditorProps {
  photos: ArticlePhotoRow[];
  onChange: (photos: ArticlePhotoRow[]) => void;
}

function moveItem(items: ArticlePhotoRow[], index: number, delta: number): ArticlePhotoRow[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

export function CoachArticlePhotoEditor({ photos, onChange }: CoachArticlePhotoEditorProps) {
  const pendingPreviewUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const photo of photos) {
      if (photo.kind === 'pending') {
        map.set(photo.key, URL.createObjectURL(photo.file));
      }
    }
    return map;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [pendingPreviewUrls]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const remaining = MAX_ARTICLE_PHOTOS - photos.length;
    if (remaining <= 0) {
      return;
    }
    const toAdd = Array.from(fileList).slice(0, remaining);
    onChange([
      ...photos,
      ...toAdd.map((file): ArticlePhotoRow => ({
        key: crypto.randomUUID(),
        kind: 'pending',
        file,
        alt: '',
        caption: '',
      })),
    ]);
  }

  function updateRow(key: string, patch: Partial<Pick<ArticlePhotoRow, 'alt' | 'caption'>>) {
    onChange(photos.map((photo) => (photo.key === key ? { ...photo, ...patch } : photo)));
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
        Photos (optional, up to {MAX_ARTICLE_PHOTOS})
      </span>

      {photos.length > 0 ? (
        <ul className="space-y-3">
          {photos.map((photo, index) => {
            const previewSrc =
              photo.kind === 'existing'
                ? getCoachArticleMediaUrl(photo.path)
                : pendingPreviewUrls.get(photo.key);

            return (
              <li
                key={photo.key}
                className="flex flex-col gap-2 rounded-card border border-border p-3 sm:flex-row"
              >
                <img
                  src={previewSrc}
                  alt={photo.alt || 'Article photo preview'}
                  className="h-24 w-full shrink-0 rounded-card border border-border object-cover sm:w-32"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    type="text"
                    className="input-field text-sm"
                    value={photo.alt}
                    placeholder="Alt text (required)"
                    maxLength={300}
                    onChange={(event) => updateRow(photo.key, { alt: event.target.value })}
                  />
                  <input
                    type="text"
                    className="input-field text-sm"
                    value={photo.caption}
                    placeholder="Caption (optional)"
                    maxLength={280}
                    onChange={(event) => updateRow(photo.key, { caption: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      disabled={index === 0}
                      onClick={() => onChange(moveItem(photos, index, -1))}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      disabled={index === photos.length - 1}
                      onClick={() => onChange(moveItem(photos, index, 1))}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-error text-xs uppercase tracking-wide hover:underline"
                      onClick={() => onChange(photos.filter((p) => p.key !== photo.key))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {photos.length < MAX_ARTICLE_PHOTOS ? (
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="block text-sm text-secondary"
          onChange={(event) => {
            handleFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />
      ) : (
        <p className="text-xs text-secondary">Maximum of {MAX_ARTICLE_PHOTOS} photos reached.</p>
      )}
    </div>
  );
}
