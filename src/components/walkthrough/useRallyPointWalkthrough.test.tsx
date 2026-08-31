import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stepsForRole } from './rallyPointWalkthrough';
import { useRallyPointWalkthrough } from './useRallyPointWalkthrough';
import { dismissWalkthroughForever, resetWalkthroughPrefs } from './walkthroughPrefs';

afterEach(() => {
  resetWalkthroughPrefs();
});

function collectStepIds(result: {
  current: ReturnType<typeof useRallyPointWalkthrough>;
}): string[] {
  const ids: string[] = [];
  while (result.current.activeStep) {
    ids.push(result.current.activeStep.id);
    act(() => {
      result.current.next();
    });
  }
  return ids;
}

describe('useRallyPointWalkthrough', () => {
  it('does not start until enabled (safety notices complete)', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useRallyPointWalkthrough({
          missionId: 'mission-a',
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
      useRallyPointWalkthrough({
        missionId: 'mission-a',
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
      useRallyPointWalkthrough({
        missionId: 'mission-a',
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
      useRallyPointWalkthrough({
        missionId: 'mission-a',
        isHost: true,
        enabled: true,
        isTargetPresent: (targetId) => targetId !== 'pacer' && targetId !== 'workout',
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
      ({ missionId }: { missionId: string }) =>
        useRallyPointWalkthrough({
          missionId,
          isHost: true,
          enabled: true,
          isTargetPresent: () => true,
        }),
      { initialProps: { missionId: 'mission-a' } }
    );

    expect(result.current.active).toBe(true);

    act(() => {
      result.current.dismissForever();
    });
    expect(result.current.complete).toBe(true);
    expect(result.current.active).toBe(false);

    rerender({ missionId: 'mission-b' });

    expect(result.current.complete).toBe(true);
    expect(result.current.active).toBe(false);
  });

  it('still shows the host tour after only the joiner tour was dismissed', () => {
    dismissWalkthroughForever('joiner');

    const { result } = renderHook(() =>
      useRallyPointWalkthrough({
        missionId: 'mission-a',
        isHost: true,
        enabled: true,
        isTargetPresent: () => true,
      })
    );

    expect(result.current.active).toBe(true);
    expect(result.current.complete).toBe(false);
  });
});
