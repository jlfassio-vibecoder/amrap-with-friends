/**
 * Which container MediaRecorder should be asked for, and what that costs.
 *
 * Safari records H.264 in MP4, which is the file an athlete can hand to
 * Instagram. Firefox records VP8/VP9 in WebM, which Instagram will not accept
 * from a phone — so the two are not interchangeable and the UI has to promise
 * different things. detectEncoderPath already splits them; this is the mime
 * string each one needs.
 *
 * Candidates are ordered most-compatible first and probed with
 * isTypeSupported, because a browser that reports MediaRecorder does not
 * thereby support any particular codec in it.
 */
export const MP4_RECORDER_TYPES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
];

export const WEBM_RECORDER_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function recorderMimeType(
  prefer: 'mp4' | 'webm',
  isTypeSupported: (type: string) => boolean
): string | null {
  const ordered = prefer === 'mp4' ? MP4_RECORDER_TYPES : WEBM_RECORDER_TYPES;
  return ordered.find((type) => isTypeSupported(type)) ?? null;
}

/** The container a produced blob should claim, from the mime the recorder accepted. */
export function blobTypeFor(mimeType: string): string {
  return mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
}

/**
 * How long to wait before capturing frame `index`.
 *
 * MediaRecorder records rather than encodes: it timestamps frames by when they
 * arrive, so pushing all 601 at once produces a 601-frame video a few
 * milliseconds long. The frames have to be handed over on the clock they will
 * be played back on, which is why this path takes as long as the replay lasts
 * and WebCodecs does not.
 */
export function frameDelayMs(timestampMicros: number, elapsedMs: number): number {
  return Math.max(0, timestampMicros / 1000 - elapsedMs);
}
