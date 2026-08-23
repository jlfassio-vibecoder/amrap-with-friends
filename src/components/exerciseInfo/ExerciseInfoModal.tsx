import { useEffect, useState } from 'react';
import type { ExerciseInfo } from '@/data/exerciseLibrary';

interface ExerciseInfoModalProps {
  info: ExerciseInfo;
  onClose: () => void;
}

type MediaTab = 'photos' | 'video';

function PhotoPlaceholder({ caption }: { caption: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-card border border-border bg-page p-2 text-center">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted"
        aria-hidden="true"
      >
        ◻
      </span>
      <span className="text-xs text-secondary">{caption}</span>
    </div>
  );
}

export function ExerciseInfoModal({ info, onClose }: ExerciseInfoModalProps) {
  const titleId = 'exercise-info-title';
  const [mediaTab, setMediaTab] = useState<MediaTab>('photos');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-2xl text-ink">
            {info.name}
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <section className="space-y-3">
          <div
            className="inline-flex rounded-full border border-border bg-page p-1"
            role="tablist"
            aria-label="Exercise media"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mediaTab === 'photos'}
              className={
                mediaTab === 'photos'
                  ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
                  : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
              }
              onClick={() => setMediaTab('photos')}
            >
              Photos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mediaTab === 'video'}
              className={
                mediaTab === 'video'
                  ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
                  : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink'
              }
              onClick={() => setMediaTab('video')}
            >
              Video
            </button>
          </div>

          {mediaTab === 'photos' ? (
            info.photos.length === 0 ? (
              <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
                No photos yet
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {info.photos.map((photo) =>
                  photo.url ? (
                    <figure key={`${photo.caption}-${photo.url}`} className="space-y-1">
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="aspect-square w-full rounded-card border border-border object-cover"
                      />
                      <figcaption className="text-center text-xs text-secondary">
                        {photo.caption}
                      </figcaption>
                    </figure>
                  ) : (
                    <PhotoPlaceholder key={photo.caption} caption={photo.caption} />
                  )
                )}
              </div>
            )
          ) : info.videoUrl ? (
            <video
              controls
              src={info.videoUrl}
              className="w-full rounded-card border border-border"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
              No video yet
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Setup &amp; execution</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            {info.setupAndExecution.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Common mistakes</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {info.commonMistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-card border border-[color:color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-accent-tint p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-accent">
            Coaching cue
          </h3>
          <p className="mt-1 text-sm italic text-ink">{info.coachingCue}</p>
        </section>
      </div>
    </div>
  );
}
