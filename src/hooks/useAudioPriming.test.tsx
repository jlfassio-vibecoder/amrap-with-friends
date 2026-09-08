import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useAudioPriming } from '@/hooks/useAudioPriming';

afterEach(cleanup);

function Harness({ unlock, enabled }: { unlock: () => void; enabled?: boolean }) {
  useAudioPriming(unlock, enabled);
  return <div>mission</div>;
}

describe('useAudioPriming', () => {
  it('does not create an audio context before any gesture', () => {
    // Autoplay policy: a context made without a gesture starts suspended and
    // the first cue is silent anyway.
    const unlock = vi.fn();
    render(<Harness unlock={unlock} />);
    expect(unlock).not.toHaveBeenCalled();
  });

  it('primes on the first tap anywhere in the view', () => {
    const unlock = vi.fn();
    render(<Harness unlock={unlock} />);
    fireEvent.pointerDown(window);
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('primes on a key press, for the spacebar athlete', () => {
    const unlock = vi.fn();
    render(<Harness unlock={unlock} />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('primes once, then stops listening', () => {
    // Decoding is idempotent, but a listener left on every tap for a whole
    // mission is a cost with nothing to buy.
    const unlock = vi.fn();
    render(<Harness unlock={unlock} />);
    fireEvent.pointerDown(window);
    fireEvent.pointerDown(window);
    fireEvent.keyDown(window, { key: 'a' });
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way during practice', () => {
    const unlock = vi.fn();
    render(<Harness unlock={unlock} enabled={false} />);
    fireEvent.pointerDown(window);
    expect(unlock).not.toHaveBeenCalled();
  });

  it('stops listening when the view unmounts', () => {
    const unlock = vi.fn();
    const { unmount } = render(<Harness unlock={unlock} />);
    unmount();
    fireEvent.pointerDown(window);
    expect(unlock).not.toHaveBeenCalled();
  });
});
