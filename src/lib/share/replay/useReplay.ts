import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { defaultCut, type CutId } from '@/lib/share/cuts';
import { detectEncoderPath, readCapabilities } from '@/lib/share/replay/encoderPath';
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

export function useReplay(data: ReplayData, draw: DrawFrameOptions): UseReplayResult {
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);
  // Re-tapping Share must not re-encode: thirty seconds of work for a file we
  // already hold.
  const cacheRef = useRef<Map<string, Blob>>(new Map());

  const teardown = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    teardown();
    setStatus('idle');
    setProgress(0);
    track('replay_cancelled', { cut: draw.layout });
  }, [teardown, draw.layout]);

  const start = useCallback(
    (requested?: CutId) => {
      const cutId = requested ?? defaultCut(data.participants.length);
      const key = `${cutId}:${draw.layout}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        setBlob(cached);
        setStatus('ready');
        return;
      }

      const path = detectEncoderPath(readCapabilities());
      if (path === 'none') {
        setError('This browser cannot make video.');
        setStatus('error');
        return;
      }

      cancelledRef.current = false;
      setStatus('rendering');
      setProgress(0);
      setError(null);
      const startedAt = performance.now();
      track('replay_render_started', { cut: cutId, path, layout: draw.layout });

      const finish = (result: Blob) => {
        cacheRef.current.set(key, result);
        setBlob(result);
        setStatus('ready');
        track('replay_render_completed', {
          cut: cutId,
          path,
          duration_ms: Math.round(performance.now() - startedAt),
          bytes: result.size,
        });
      };

      const fail = (message: string) => {
        setError(message);
        setStatus('error');
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
            setProgress(message.frame / message.total);
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
          onProgress: (frame, total) => setProgress(frame / total),
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
    [data, draw, teardown]
  );

  return { status, progress, blob, error, start, cancel };
}
