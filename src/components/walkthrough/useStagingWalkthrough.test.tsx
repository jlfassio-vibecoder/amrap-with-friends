import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stepsForRole } from './stagingWalkthrough';
import { useStagingWalkthrough } from './useStagingWalkthrough';
import {
  dismissWalkthroughForever,
  resetWalkthroughPrefs,
} from './walkthroughPrefs';

afterEach(() => {
  resetWalkthroughPrefs();
});

function collectStepIds(
  result: { current: ReturnType<typeof useStagingWalkthrough> }
): string[] {
  const ids: string[] = [];
  while (result.current.activeStep) {
    ids.push(result.current.activeStep.id);
    act(() => {
      result.current.next();
    });
  }
  return ids;
}

describe('useStagingWalkthrough', () => {
  it('does not start until enabled (safety notices complete)', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useStagingWalkthrough({
          sessionId: 'session-a',
          isHost: true,
          enabled,
          isTargetPresent: () => true,
        }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.active).toBe(false);
    expect(result.current.showingFinale).toBe(false);
    expect(result.current.complete).toBe(false);

    rerender({ enabled: true });

    expect(result.current.active).toBe(true);
    expect(result.current.activeStep?.id).toBe('status');
    expect(result.current.complete).toBe(false);
  });

  it('uses host steps including the countdown and Start', () => {
    const { result } = renderHook(() =>
      useStagingWalkthrough({
        sessionId: 'session-a',
        isHost: true,
        enabled: true,
        isTargetPresent: () => true,
      })
    );

    const ids = collectStepIds(result);

    expect(ids).toEqual(stepsForRole(true).map((step) => step.id));
    expect(ids).toContain('t-minus');
    expect(ids).toContain('start');
    expect(ids).not.toContain('waiting-on-host');
    expect(ids).not.toContain('practice');
    expect(result.current.showingFinale).toBe(true);
    expect(result.current.complete).toBe(false);
  });

  it('uses joiner steps including waiting-on-host and Practice', () => {
    const { result } = renderHook(() =>
      useStagingWalkthrough({
        sessionId: 'session-a',
        isHost: false,
        enabled: true,
        isTargetPresent: () => true,
      })
    );

    const ids = collectStepIds(result);

    expect(ids).toEqual(stepsForRole(false).map((step) => step.id));
    expect(ids).toContain('waiting-on-host');
    expect(ids).toContain('practice');
    expect(ids).not.toContain('t-minus');
    expect(ids).not.toContain('start');
  });

  it('skips steps whose targets are missing', () => {
    const { result } = renderHook(() =>
      useStagingWalkthrough({
        sessionId: 'session-a',
        isHost: true,
        enabled: true,
        isTargetPresent: (targetId) =>
          targetId !== 'pacer' && targetId !== 'workout',
      })
    );

    const ids = collectStepIds(result);

    expect(ids).not.toContain('pacer');
    expect(ids).not.toContain('workout');
    expect(ids).toContain('status');
    expect(ids).toContain('start');
  });

  it('does not rerun after dismissForever', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useStagingWalkthrough({
          sessionId,
          isHost: true,
          enabled: true,
          isTargetPresent: () => true,
        }),
      { initialProps: { sessionId: 'session-a' } }
    );

    expect(result.current.active).toBe(true);

    act(() => {
      result.current.dismissForever();
    });
    expect(result.current.complete).toBe(true);
    expect(result.current.active).toBe(false);

    rerender({ sessionId: 'session-b' });

    expect(result.current.complete).toBe(true);
    expect(result.current.active).toBe(false);
  });

  it('still shows the host tour after only the joiner tour was dismissed', () => {
    dismissWalkthroughForever('joiner');

    const { result } = renderHook(() =>
      useStagingWalkthrough({
        sessionId: 'session-a',
        isHost: true,
        enabled: true,
        isTargetPresent: () => true,
      })
    );

    expect(result.current.active).toBe(true);
    expect(result.current.complete).toBe(false);
  });
});
