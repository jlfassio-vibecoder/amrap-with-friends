import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMissionLockedModal } from '@/hooks/useMissionLockedModal';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

function setup(initialPhase: LiveMissionPhase, isPractice = false) {
  return renderHook(
    ({ phase, isPractice: practice }: { phase: LiveMissionPhase; isPractice: boolean }) =>
      useMissionLockedModal(phase, practice),
    { initialProps: { phase: initialPhase, isPractice } }
  );
}

describe('useMissionLockedModal', () => {
  it('is hidden on first paint, even one that lands directly in setup', () => {
    const { result } = setup('setup');
    expect(result.current.visible).toBe(false);
  });

  it('opens on the transition from waiting into setup', () => {
    const { result, rerender } = setup('waiting');
    rerender({ phase: 'setup', isPractice: false });
    expect(result.current.visible).toBe(true);
  });

  it('closes on its own once setup ends', () => {
    const { result, rerender } = setup('waiting');
    rerender({ phase: 'setup', isPractice: false });
    expect(result.current.visible).toBe(true);

    rerender({ phase: 'work', isPractice: false });
    expect(result.current.visible).toBe(false);
  });

  it('closes early on dismiss without waiting for work to begin', () => {
    const { result, rerender } = setup('waiting');
    rerender({ phase: 'setup', isPractice: false });
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.visible).toBe(false);

    // Still in setup afterward: the early dismiss must not come back on its
    // own, and the countdown it sits on top of is unaffected either way.
    rerender({ phase: 'setup', isPractice: false });
    expect(result.current.visible).toBe(false);
  });

  it('never opens during practice', () => {
    const { result, rerender } = setup('waiting', true);
    rerender({ phase: 'setup', isPractice: true });
    expect(result.current.visible).toBe(false);
  });
});
