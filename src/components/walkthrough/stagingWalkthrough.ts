export type WalkthroughRole = 'host' | 'joiner';

export type WalkthroughStepRole = WalkthroughRole | 'all';

export const WALKTHROUGH_TARGET = {
  status: 'status',
  tMinus: 't-minus',
  rallyLink: 'rally-link',
  pacer: 'pacer',
  actions: 'actions',
  workout: 'workout',
  chat: 'chat',
  participants: 'participants',
} as const;

export type WalkthroughTargetId =
  (typeof WALKTHROUGH_TARGET)[keyof typeof WALKTHROUGH_TARGET];

export interface StagingWalkthroughStep {
  id: string;
  role: WalkthroughStepRole;
  targetId: WalkthroughTargetId;
  title: string;
  body: string;
}

export const STAGING_WALKTHROUGH_STEPS: StagingWalkthroughStep[] = [
  {
    id: 'status',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.status,
    title: 'This is staging',
    body: 'Waiting means the clock has not started. Realtime shows whether you are connected to the live session.',
  },
  {
    id: 'waiting-on-host',
    role: 'joiner',
    targetId: WALKTHROUGH_TARGET.status,
    title: 'The host starts it',
    body: 'You are in. The host will engage the clock when everyone is ready. Hang tight until then.',
  },
  {
    id: 't-minus',
    role: 'host',
    targetId: WALKTHROUGH_TARGET.tMinus,
    title: 'Set the countdown',
    body: 'Set a countdown, then press Start countdown. When it hits zero, press Start to begin the workout for everyone.',
  },
  {
    id: 'rally-link',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.rallyLink,
    title: 'Invite the crew',
    body: 'Copy the rally link and send it to friends. Anyone with the link can join this staging area.',
  },
  {
    id: 'pacer',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.pacer,
    title: 'Race a pacer',
    body: 'Solo on a template? Pick your personal best and chase that pacing curve in real time.',
  },
  {
    id: 'start',
    role: 'host',
    targetId: WALKTHROUGH_TARGET.actions,
    title: 'Start or practice',
    body: 'Start runs the real session. Practice is a short unrecorded run so you can feel the flow first.',
  },
  {
    id: 'practice',
    role: 'joiner',
    targetId: WALKTHROUGH_TARGET.actions,
    title: 'Practice while you wait',
    body: 'Practice is a short unrecorded run. It does not start the session for everyone else.',
  },
  {
    id: 'workout',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.workout,
    title: 'Review the workout',
    body: 'These are the movements. Tap How to on any exercise before you start.',
  },
  {
    id: 'chat',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.chat,
    title: 'Talk it out',
    body: 'Use chat to coordinate, call out scaling, or just talk trash before the clock.',
  },
  {
    id: 'participants',
    role: 'all',
    targetId: WALKTHROUGH_TARGET.participants,
    title: 'Who is here',
    body: 'This roster updates live. You will see scores here once the work starts.',
  },
];

export function stepsForRole(isHost: boolean): StagingWalkthroughStep[] {
  const role: WalkthroughRole = isHost ? 'host' : 'joiner';
  return STAGING_WALKTHROUGH_STEPS.filter(
    (step) => step.role === 'all' || step.role === role
  );
}

export function walkthroughTargetSelector(targetId: string): string {
  return `[data-walkthrough-id="${targetId}"]`;
}
