import { useEffect, useState } from 'react';
import type { ExerciseInfo } from '@/data/exerciseLibrary';
import { getExerciseMediaUrl } from '@/lib/media/getExerciseMediaUrl';
import { getPhotoGridColumnCount } from '@/components/exerciseInfo/getPhotoGridColumnCount';

interface ExerciseInfoModalProps {
  info: ExerciseInfo;
  onClose: () => void;
}

type MediaTab = 'photos' | 'video';

function PhotoPlaceholder({ caption }: { caption?: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-card border border-border bg-page p-2 text-center">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted"
        aria-hidden="true"
      >
        ◻
      </span>
      {caption ? <span className="text-xs text-secondary">{caption}</span> : null}
    </div>
  );
}

export function ExerciseInfoModal({ info, onClose }: ExerciseInfoModalProps) {
  const titleId = 'exercise-info-title';
  const [mediaTab, setMediaTab] = useState<MediaTab>('photos');
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Record<string, true>>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const videoSrc = info.videoUrl ? getExerciseMediaUrl(info.videoUrl) : '';
  const photoColumns = getPhotoGridColumnCount(info.photos.length);

  function photoFailureKey(photoUrl: string): string {
    return `${info.id}:${photoUrl}`;
  }

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
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${photoColumns}, minmax(0, 1fr))`,
                }}
                data-testid="exercise-photo-grid"
                data-columns={photoColumns}
              >
                {info.photos.map((photo, index) => {
                  const showPlaceholder =
                    !photo.url || failedPhotoUrls[photoFailureKey(photo.url)];
                  const cellKey = `${photo.url || 'empty'}-${photo.caption || index}`;

                  if (showPlaceholder) {
                    return (
                      <PhotoPlaceholder key={cellKey} caption={photo.caption} />
                    );
                  }

                  return (
                    <figure key={cellKey} className="space-y-1">
                      <img
                        src={getExerciseMediaUrl(photo.url)}
                        alt={photo.caption || info.name}
                        className="aspect-square w-full rounded-card border border-border object-cover"
                        onError={() => {
                          setFailedPhotoUrls((prev) => ({
                            ...prev,
                            [photoFailureKey(photo.url)]: true,
                          }));
                        }}
                      />
                      {photo.caption ? (
                        <figcaption className="text-center text-xs text-secondary">
                          {photo.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  );
                })}
              </div>
            )
          ) : videoSrc ? (
            <video controls src={videoSrc} className="w-full rounded-card border border-border">
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

        {info.commonMistakes.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Common mistakes</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
              {info.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-card border border-[color:color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-accent-tint p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-accent">
            Coaching cue
          </h3>
          <p className="mt-1 text-sm italic text-ink">{info.coachingCue}</p>
        </section>

        {info.amrapTip ? (
          <section className="rounded-card border border-border bg-page p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-secondary">
              AMRAP tip
            </h3>
            <p className="mt-1 text-sm text-ink">{info.amrapTip}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
