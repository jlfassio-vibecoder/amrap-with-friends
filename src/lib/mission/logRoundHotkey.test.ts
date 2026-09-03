import { describe, expect, it } from 'vitest';
import { shouldHandleLogRoundHotkey } from './logRoundHotkey';

function event(
  overrides: Partial<{
    key: string;
    code: string;
    repeat: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  }> = {}
) {
  return {
    key: ' ',
    code: 'Space',
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: document.body,
    ...overrides,
  };
}

describe('shouldHandleLogRoundHotkey', () => {
  it('handles Space on a non-editable target', () => {
    expect(shouldHandleLogRoundHotkey(event())).toBe(true);
    expect(shouldHandleLogRoundHotkey(event({ key: 'Spacebar', code: 'Space' }))).toBe(true);
  });

  it('ignores non-Space keys', () => {
    expect(shouldHandleLogRoundHotkey(event({ key: 'Enter', code: 'Enter' }))).toBe(false);
  });

  it('ignores key repeat and modifiers', () => {
    expect(shouldHandleLogRoundHotkey(event({ repeat: true }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ ctrlKey: true }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ metaKey: true }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ altKey: true }))).toBe(false);
  });

  it('ignores typing targets', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';

    expect(shouldHandleLogRoundHotkey(event({ target: input }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ target: textarea }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ target: select }))).toBe(false);
    expect(shouldHandleLogRoundHotkey(event({ target: editable }))).toBe(false);
  });

  it('handles Space on a button', () => {
    const button = document.createElement('button');
    expect(shouldHandleLogRoundHotkey(event({ target: button }))).toBe(true);
  });
});
