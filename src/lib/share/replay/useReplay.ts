import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { defaultCut, type CutId } from '@/lib/share/cuts';
import {
  detectEncoderPath,
  isEncoderImplemented,
  readCapabilities,
} from '@/lib/share/replay/encoderPath';
import { renderReplay } from '@/lib/share/replay/renderReplay';
import type { ReplayWorkerMessage, ReplayWorkerRequest } from '@/lib/share/replay/replay.worker';
import type { DrawFrameOptions } from '@/lib/share/renderer/drawFrame';
import type { ReplayData } from '@/lib/share/types';

export type ReplayStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface UseReplayResult {
  status: ReplayStatus;
  progress: number;
  blob: Blob | null;
  error: string | null;
  start: (cutId?: CutId) => void;
  cancel: () => void;
}

/**
 * @param inputKey Identifies everything the render depends on that this hook
 * cannot see — the card shape, the variant, which photo is loaded. When it
 * changes, a finished replay no longer matches the card on screen, so it stops
 * being offered rather than being handed over as if it did.
 */
export function useReplay(
  data: ReplayData,
  draw: DrawFrameOptions,
  inputKey: string
): UseReplayResult {
  // Finished renders, kept by `${cut}:${inputKey}`. Re-tapping must not
  // re-encode -- that is thirty seconds of work for a file already held -- and
  // holding them in state rather than a ref is what lets everything below be
  // derived during render instead of corrected afterwards in an effect.
  const [renders, setRenders] = useState<Record<string, Blob>>({});
  // The cut the athlete last asked for, so a change of shape looks for the
  // matching render rather than starting from nothing.
  const [cut, setCut] = useState<CutId | null>(null);
  // What is happening, and which card it is happening to. Without the second
  // half, a render started for one shape would still read as in-progress after
  // switching to another.
  const [phase, setPhase] = useState<{
    key: string;
    status: Exclude<ReplayStatus, 'ready'>;
    progress: number;
    error: string | null;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);

  // A replay belongs to one card. Derived, so a shape change cannot leave a
  // stale "ready" on screen holding the file made for the previous one.
  const activeKey = cut === null ? null : `${cut}:${inputKey}`;
  const blob = activeKey === null ? null : (renders[activeKey] ?? null);
  const current = phase !== null && phase.key === activeKey ? phase : null;
  const status: ReplayStatus = blob ? 'ready' : (current?.status ?? 'idle');
  const progress = current?.progress ?? 0;
  const error = current?.error ?? null;

  const teardown = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    teardown();
    setPhase(null);
    track('replay_cancelled', { cut: draw.layout });
  }, [teardown, draw.layout]);

  const start = useCallback(
    (requested?: CutId) => {
      const cutId = requested ?? defaultCut(data.participants.length);
      setCut(cutId);
      const key = `${cutId}:${inputKey}`;
      if (renders[key]) {
        setPhase(null);
        return;
      }

      const path = detectEncoderPath(readCapabilities());
      // renderReplay only has a WebCodecs sink. Refusing here keeps the
      // failure a message rather than a throw from inside the encoder, on a
      // screen the athlete reached by finishing a workout.
      if (!isEncoderImplemented(path)) {
        setPhase({ key, status: 'error', progress: 0, error: 'This browser cannot make video.' });
        return;
      }

      cancelledRef.current = false;
      setPhase({ key, status: 'rendering', progress: 0, error: null });
      const startedAt = performance.now();
      track('replay_render_started', { cut: cutId, path, layout: draw.layout });

      const finish = (result: Blob) => {
        setRenders((previous) => ({ ...previous, [key]: result }));
        setPhase(null);
        track('replay_render_completed', {
          cut: cutId,
          path,
          duration_ms: Math.round(performance.now() - startedAt),
          bytes: result.size,
        });
      };

      const fail = (message: string) => {
        setPhase({ key, status: 'error', progress: 0, error: message });
      };

      // OffscreenCanvas is the whole reason for the worker; without it the
      // fallback runs the identical pipeline inline rather than shipping a
      // second implementation.
      if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function') {
        const worker = new Worker(new URL('./replay.worker.ts', import.meta.url), {
          type: 'module',
        });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<ReplayWorkerMessage>) => {
          const message = event.data;
          if (message.type === 'progress') {
            const ratio = message.frame / message.total;
            setPhase((previous) =>
              previous && previous.key === key ? { ...previous, progress: ratio } : previous
            );
          } else if (message.type === 'done') {
            finish(message.blob);
            teardown();
          } else {
            fail(message.message);
            teardown();
          }
        };
        const request: ReplayWorkerRequest = { data, cutId, draw };
        worker.postMessage(request);
        return;
      }

      void renderReplay(
        {
          data,
          cutId,
          draw,
          onProgress: (frame, total) =>
            setPhase((previous) =>
              previous && previous.key === key ? { ...previous, progress: frame / total } : previous
            ),
          isCancelled: () => cancelledRef.current,
        },
        (width, height) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          return { canvas, ctx: canvas.getContext('2d') };
        }
      )
        .then(finish)
        .catch((cause: unknown) => {
          if (!cancelledRef.current) {
            fail(cause instanceof Error ? cause.message : 'render failed');
          }
        });
    },
    [data, draw, inputKey, renders, teardown]
  );

  return { status, progress, blob, error, start, cancel };
}
