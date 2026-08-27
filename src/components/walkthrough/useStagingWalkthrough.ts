import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  stepsForRole,
  walkthroughTargetSelector,
  type StagingWalkthroughStep,
  type WalkthroughRole,
} from './stagingWalkthrough';
import {
  dismissWalkthroughForever,
  isWalkthroughDismissed,
} from './walkthroughPrefs';

export type WalkthroughStatus = 'idle' | 'running' | 'finale' | 'done';

function defaultIsTargetPresent(targetId: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector(walkthroughTargetSelector(targetId)) !== null;
}

function resolveStep(
  steps: StagingWalkthroughStep[],
  fromIndex: number,
  isTargetPresent: (targetId: string) => boolean
): { step: StagingWalkthroughStep | null; index: number } {
  for (let index = Math.max(0, fromIndex); index < steps.length; index += 1) {
    const step = steps[index];
    if (step && isTargetPresent(step.targetId)) {
      return { step, index };
    }
  }
  return { step: null, index: steps.length };
}

export function useStagingWalkthrough({
  sessionId,
  isHost,
  enabled,
  isTargetPresent = defaultIsTargetPresent,
}: {
  sessionId: string;
  isHost: boolean;
  enabled: boolean;
  isTargetPresent?: (targetId: string) => boolean;
}): {
  status: WalkthroughStatus;
  active: boolean;
  showingFinale: boolean;
  complete: boolean;
  activeStep: StagingWalkthroughStep | null;
  next: () => void;
  skipVisit: () => void;
  dismissForever: () => void;
  confirmLetsDoThis: () => void;
} {
  const role: WalkthroughRole = isHost ? 'host' : 'joiner';
  const steps = useMemo(() => stepsForRole(isHost), [isHost]);
  const [status, setStatus] = useState<WalkthroughStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEpoch, setTargetEpoch] = useState(0);

  useEffect(() => {
    setStatus(isWalkthroughDismissed(role) ? 'done' : 'idle');
    setStepIndex(0);
  }, [sessionId, role]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (isWalkthroughDismissed(role)) {
      setStatus('done');
      return;
    }
    setStatus((current) => (current === 'idle' ? 'running' : current));
  }, [enabled, role]);

  const resolved = useMemo(
    () => resolveStep(steps, stepIndex, isTargetPresent),
    [steps, stepIndex, isTargetPresent, targetEpoch]
  );

  useEffect(() => {
    if (status !== 'running') {
      return;
    }
    if (resolved.step === null) {
      setStatus('finale');
      return;
    }
    if (resolved.index !== stepIndex) {
      setStepIndex(resolved.index);
    }
  }, [status, resolved, stepIndex]);

  const next = useCallback(() => {
    const upcoming = resolveStep(steps, stepIndex + 1, isTargetPresent);
    if (upcoming.step === null) {
      setStatus('finale');
      return;
    }
    setStepIndex(upcoming.index);
  }, [isTargetPresent, stepIndex, steps]);

  const skipVisit = useCallback(() => {
    setStatus('done');
  }, []);

  const confirmLetsDoThis = useCallback(() => {
    setStatus('done');
  }, []);

  const dismissForever = useCallback(() => {
    dismissWalkthroughForever(role);
    setStatus('done');
  }, [role]);

  const recheckTargets = useCallback(() => {
    setTargetEpoch((current) => current + 1);
  }, []);

  useEffect(() => {
    if (status !== 'running' || !enabled) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      recheckTargets();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, status, recheckTargets, sessionId]);

  const complete = status === 'done' || isWalkthroughDismissed(role);
  const active = enabled && status === 'running' && resolved.step !== null;
  const showingFinale = enabled && status === 'finale';

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
