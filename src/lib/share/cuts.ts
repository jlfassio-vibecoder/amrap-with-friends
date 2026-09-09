/**
 * Video time → mission time.
 *
 * The storyboard is four beats, and each one maps a slice of video time onto a
 * slice of the mission. Keeping the mapping as data rather than branches means
 * a new cut is a table entry, and `frameAt` stays one code path — which is what
 * makes it safe to call 600 times and get an identical result each time.
 */
export interface CutPhase {
  phase: 'title' | 'race' | 'finish' | 'freeze';
  /** Video seconds this phase occupies, [from, to). */
  from: number;
  to: number;
  /** Mission seconds this phase covers. Title and freeze are frozen instants. */
  missionFrom: number | null;
  missionTo: number | null;
}

export type CutId = 'full20' | 'story9';

export interface Cut {
  id: CutId;
  durationSeconds: number;
  /** Mission seconds shown at 1x at the end — the part worth watching properly. */
  realTimeTailSeconds: number;
  phases: (capSeconds: number) => CutPhase[];
}

function build(
  durationSeconds: number,
  tail: number,
  marks: { title: number; race: number; finish: number }
) {
  return (capSeconds: number): CutPhase[] => {
    // A mission shorter than the real-time tail has no compressed section to
    // show; the race phase collapses rather than running backwards.
    const tailStart = Math.max(0, capSeconds - tail);
    return [
      {
        phase: 'title',
        from: 0,
        to: marks.title,
        missionFrom: 0,
        missionTo: 0,
      },
      {
        phase: 'race',
        from: marks.title,
        to: marks.race,
        missionFrom: 0,
        missionTo: tailStart,
      },
      {
        phase: 'finish',
        from: marks.race,
        to: marks.finish,
        missionFrom: tailStart,
        missionTo: capSeconds,
      },
      {
        phase: 'freeze',
        from: marks.finish,
        to: durationSeconds,
        missionFrom: capSeconds,
        missionTo: capSeconds,
      },
    ];
  };
}

export const CUTS: Record<CutId, Cut> = {
  full20: {
    id: 'full20',
    durationSeconds: 20,
    realTimeTailSeconds: 10,
    phases: build(20, 10, { title: 2, race: 8, finish: 18 }),
  },
  story9: {
    id: 'story9',
    durationSeconds: 9,
    realTimeTailSeconds: 3,
    phases: build(9, 3, { title: 1, race: 5, finish: 8 }),
  },
};

/** A two-person race does not need twenty seconds. */
export function defaultCut(participantCount: number): CutId {
  return participantCount <= 2 ? 'story9' : 'full20';
}

export function phaseAt(cut: Cut, capSeconds: number, t: number): CutPhase {
  const phases = cut.phases(capSeconds);
  const clamped = Math.max(0, Math.min(cut.durationSeconds, t));
  return (
    phases.find((phase) => clamped >= phase.from && clamped < phase.to) ??
    (phases[phases.length - 1] as CutPhase)
  );
}

/** Where the mission clock stands at video time `t`. Linear within each phase. */
export function missionTimeAt(cut: Cut, capSeconds: number, t: number): number {
  const phase = phaseAt(cut, capSeconds, t);
  if (phase.missionFrom === null || phase.missionTo === null) {
    return 0;
  }
  const span = phase.to - phase.from;
  if (span <= 0) {
    return phase.missionTo;
  }
  const progress = Math.max(0, Math.min(1, (t - phase.from) / span));
  return phase.missionFrom + (phase.missionTo - phase.missionFrom) * progress;
}
