import { useCallback, useMemo, useState } from 'react';
import {
  stepsForRole,
  walkthroughTargetSelector,
  type RallyPointWalkthroughStep,
  type WalkthroughRole,
} from './rallyPointWalkthrough';
import { dismissWalkthroughForever, isWalkthroughDismissed } from './walkthroughPrefs';

export type WalkthroughStatus = 'idle' | 'running' | 'finale' | 'done';

type WalkthroughState = {
  key: string;
  status: 'idle' | 'done';
  stepIndex: number;
};

function defaultIsTargetPresent(targetId: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector(walkthroughTargetSelector(targetId)) !== null;
}

function resolveStep(
  steps: RallyPointWalkthroughStep[],
  fromIndex: number,
  isTargetPresent: (targetId: string) => boolean
): { step: RallyPointWalkthroughStep | null; index: number } {
  for (let index = Math.max(0, fromIndex); index < steps.length; index += 1) {
    const step = steps[index];
    if (step && isTargetPresent(step.targetId)) {
      return { step, index };
    }
  }
  return { step: null, index: steps.length };
}

function initialState(key: string, role: WalkthroughRole): WalkthroughState {
  return {
    key,
    status: isWalkthroughDismissed(role) ? 'done' : 'idle',
    stepIndex: 0,
  };
}

export function useRallyPointWalkthrough({
  missionId,
  isHost,
  enabled,
  isTargetPresent = defaultIsTargetPresent,
}: {
  missionId: string;
  isHost: boolean;
  enabled: boolean;
  isTargetPresent?: (targetId: string) => boolean;
}): {
  status: WalkthroughStatus;
  active: boolean;
  showingFinale: boolean;
  complete: boolean;
  activeStep: RallyPointWalkthroughStep | null;
  next: () => void;
  skipVisit: () => void;
  dismissForever: () => void;
  confirmLetsDoThis: () => void;
} {
  const role: WalkthroughRole = isHost ? 'host' : 'joiner';
  const walkthroughKey = `${missionId}:${role}`;
  const steps = useMemo(() => stepsForRole(isHost), [isHost]);
  const [state, setState] = useState<WalkthroughState>(() => initialState(walkthroughKey, role));

  const normalized = state.key === walkthroughKey ? state : initialState(walkthroughKey, role);

  const dismissed = isWalkthroughDismissed(role);
  const baseStatus = dismissed ? 'done' : normalized.status;
  const effectiveStatus: WalkthroughStatus = dismissed
    ? 'done'
    : enabled && baseStatus === 'idle'
      ? 'running'
      : baseStatus;

  const resolved = useMemo(
    () => resolveStep(steps, normalized.stepIndex, isTargetPresent),
    [steps, normalized.stepIndex, isTargetPresent]
  );

  const showingFinale = enabled && effectiveStatus === 'running' && resolved.step === null;
  const status: WalkthroughStatus = showingFinale ? 'finale' : effectiveStatus;
  const complete = status === 'done' || dismissed;
  const active = enabled && status === 'running' && resolved.step !== null;

  const next = useCallback(() => {
    const from = state.key === walkthroughKey ? state.stepIndex : 0;
    const upcoming = resolveStep(steps, from + 1, isTargetPresent);
    setState({
      key: walkthroughKey,
      status: 'idle',
      stepIndex: upcoming.step === null ? steps.length : upcoming.index,
    });
  }, [state.key, state.stepIndex, walkthroughKey, steps, isTargetPresent]);

  const skipVisit = useCallback(() => {
    setState({
      key: walkthroughKey,
      status: 'done',
      stepIndex: state.key === walkthroughKey ? state.stepIndex : 0,
    });
  }, [walkthroughKey, state.key, state.stepIndex]);

  const confirmLetsDoThis = useCallback(() => {
    setState({
      key: walkthroughKey,
      status: 'done',
      stepIndex: state.key === walkthroughKey ? state.stepIndex : 0,
    });
  }, [walkthroughKey, state.key, state.stepIndex]);

  const dismissForever = useCallback(() => {
    dismissWalkthroughForever(role);
    setState({
      key: walkthroughKey,
      status: 'done',
      stepIndex: state.key === walkthroughKey ? state.stepIndex : 0,
    });
  }, [role, walkthroughKey, state.key, state.stepIndex]);

  return {
    status,
    active,
    showingFinale,
    complete,
    activeStep: active ? resolved.step : null,
    next,
    skipVisit,
    dismissForever,
    confirmLetsDoThis,
  };
}
