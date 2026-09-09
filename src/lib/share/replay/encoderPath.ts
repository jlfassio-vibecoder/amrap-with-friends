export type EncoderPath = 'webcodecs' | 'mediarecorder-mp4' | 'mediarecorder-webm' | 'none';

export interface EncoderCapabilities {
  hasVideoEncoder: boolean;
  hasMediaRecorder: boolean;
  isTypeSupported?: (type: string) => boolean;
  hasCaptureStream: boolean;
}

/**
 * Which encoder this device can actually use.
 *
 * Ordered by what the athlete gets, not by what is newest. WebCodecs comes
 * first because it drives the phone's hardware encoder and finishes faster
 * than real time; MediaRecorder takes twenty seconds to make a twenty-second
 * video because it records rather than encodes.
 *
 * The mp4/webm split is not a detail. WebM will not upload to Instagram from
 * iOS, so a device that can only produce WebM gets a different promise from
 * the UI — "Download replay", not "Share replay". Discovering that after a
 * thirty-second render would be worse than never offering it.
 */
export function detectEncoderPath(capabilities: EncoderCapabilities): EncoderPath {
  if (capabilities.hasVideoEncoder) {
    return 'webcodecs';
  }
  if (capabilities.hasMediaRecorder && capabilities.hasCaptureStream) {
    const supports = capabilities.isTypeSupported;
    if (supports?.('video/mp4')) {
      return 'mediarecorder-mp4';
    }
    if (supports?.('video/webm;codecs=vp9') || supports?.('video/webm')) {
      return 'mediarecorder-webm';
    }
  }
  return 'none';
}

export function readCapabilities(): EncoderCapabilities {
  const scope = globalThis as unknown as {
    VideoEncoder?: unknown;
    MediaRecorder?: { isTypeSupported?: (type: string) => boolean };
    HTMLCanvasElement?: { prototype?: { captureStream?: unknown } };
  };
  return {
    hasVideoEncoder: typeof scope.VideoEncoder === 'function',
    hasMediaRecorder: typeof scope.MediaRecorder === 'function',
    isTypeSupported: scope.MediaRecorder?.isTypeSupported?.bind(scope.MediaRecorder),
    hasCaptureStream: typeof scope.HTMLCanvasElement?.prototype?.captureStream === 'function',
  };
}

/**
 * Whether this path has an implementation behind it.
 *
 * detectEncoderPath reports what the *browser* can do; phase 2 only built the
 * WebCodecs sink. Keeping the two separate is deliberate — the detection stays
 * honest about the device, and this says what we have actually shipped, so the
 * MediaRecorder paths can be turned on by changing one line here when the sink
 * exists. Conflating them would have hidden which was missing.
 */
export function isEncoderImplemented(path: EncoderPath): boolean {
  return path === 'webcodecs';
}

/** What the button should say. A WebM file is a download, not a share. */
export function replayActionLabel(path: EncoderPath): string {
  return path === 'mediarecorder-webm' ? 'Download replay' : 'Share replay';
}

export function replayCaveat(path: EncoderPath): string | null {
  if (path === 'mediarecorder-webm') {
    return 'This browser can only make WebM video, which Instagram will not accept from a phone. The file will download instead.';
  }
  if (!isEncoderImplemented(path) && path !== 'none') {
    return 'Replays need a browser with video encoding support. Your card is ready to share now.';
  }
  return null;
}
