import { describe, expect, it } from 'vitest';
import {
  detectEncoderPath,
  replayActionLabel,
  replayCaveat,
  type EncoderCapabilities,
} from '@/lib/share/replay/encoderPath';

function caps(overrides: Partial<EncoderCapabilities> = {}): EncoderCapabilities {
  return { hasVideoEncoder: false, hasMediaRecorder: false, hasCaptureStream: false, ...overrides };
}

describe('detectEncoderPath', () => {
  it('prefers WebCodecs, which encodes faster than real time', () => {
    expect(detectEncoderPath(caps({ hasVideoEncoder: true }))).toBe('webcodecs');
  });

  it('falls back to MediaRecorder with mp4 when Safari offers it', () => {
    expect(
      detectEncoderPath(
        caps({
          hasMediaRecorder: true,
          hasCaptureStream: true,
          isTypeSupported: (type) => type === 'video/mp4',
        })
      )
    ).toBe('mediarecorder-mp4');
  });

  it('reports webm separately, because it will not upload to Instagram', () => {
    expect(
      detectEncoderPath(
        caps({
          hasMediaRecorder: true,
          hasCaptureStream: true,
          isTypeSupported: (type) => type.startsWith('video/webm'),
        })
      )
    ).toBe('mediarecorder-webm');
  });

  it('needs captureStream as well as MediaRecorder', () => {
    expect(detectEncoderPath(caps({ hasMediaRecorder: true, isTypeSupported: () => true }))).toBe(
      'none'
    );
  });

  it('reports none when nothing is available', () => {
    expect(detectEncoderPath(caps())).toBe('none');
    expect(
      detectEncoderPath(
        caps({ hasMediaRecorder: true, hasCaptureStream: true, isTypeSupported: () => false })
      )
    ).toBe('none');
  });
});

describe('the promise the UI makes', () => {
  it('offers to share an mp4 and only to download a webm', () => {
    expect(replayActionLabel('webcodecs')).toBe('Share replay');
    expect(replayActionLabel('mediarecorder-mp4')).toBe('Share replay');
    expect(replayActionLabel('mediarecorder-webm')).toBe('Download replay');
  });

  it('explains the webm limitation before a 30-second render, not after', () => {
    expect(replayCaveat('mediarecorder-webm')).toContain('Instagram');
    expect(replayCaveat('webcodecs')).toBeNull();
  });
});
