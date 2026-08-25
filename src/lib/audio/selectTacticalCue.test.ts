import { describe, expect, it } from 'vitest';
import { selectTacticalCue } from '@/lib/audio/selectTacticalCue';
import type { TacticalClockSnapshot } from '@/lib/audio/selectTacticalCue';

function snap(
  overrides: Partial<TacticalClockSnapshot> & Pick<TacticalClockSnapshot, 'phase'>
): TacticalClockSnapshot {
  return {
    timeLeftSec: 10,
    isPaused: false,
    workDurationSec: 300,
    ...overrides,
  };
}

describe('selectTacticalCue', () => {
  it('plays ignition when entering setup', () => {
    expect(
      selectTacticalCue(snap({ phase: 'waiting', timeLeftSec: 10 }), snap({ phase: 'setup', timeLeftSec: 10 }))
    ).toEqual(['ignition']);
  });

  it('plays ignition on first paint of setup', () => {
    expect(selectTacticalCue(null, snap({ phase: 'setup', timeLeftSec: 10 }))).toEqual([
      'ignition',
    ]);
  });

  it('plays ignition then prep when setup begins at 3', () => {
    expect(selectTacticalCue(null, snap({ phase: 'setup', timeLeftSec: 3 }))).toEqual([
      'ignition',
      'prep',
    ]);
  });

  it('plays prep blips at setup 3, 2, 1', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 4 }),
        snap({ phase: 'setup', timeLeftSec: 3 })
      )
    ).toEqual(['prep']);
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 3 }),
        snap({ phase: 'setup', timeLeftSec: 2 })
      )
    ).toEqual(['prep']);
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 2 }),
        snap({ phase: 'setup', timeLeftSec: 1 })
      )
    ).toEqual(['prep']);
  });

  it('plays GO on setup to work', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 1 }),
        snap({ phase: 'work', timeLeftSec: 300 })
      )
    ).toEqual(['go']);
  });

  it('does not play minute mark on the first work frame at full duration', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 1 }),
        snap({ phase: 'work', timeLeftSec: 300, workDurationSec: 300 })
      )
    ).toEqual(['go']);
  });

  it('plays minute mark at remaining 120', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 121 }),
        snap({ phase: 'work', timeLeftSec: 120 })
      )
    ).toEqual(['minute']);
  });

  it('plays final minute at remaining 60, not a minute mark', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 61 }),
        snap({ phase: 'work', timeLeftSec: 60 })
      )
    ).toEqual(['finalMinute']);
  });

  it('plays terminal blips at 5 through 1', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 6 }),
        snap({ phase: 'work', timeLeftSec: 5 })
      )
    ).toEqual(['terminal']);
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 2 }),
        snap({ phase: 'work', timeLeftSec: 1 })
      )
    ).toEqual(['terminal']);
  });

  it('plays END on work to finished', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 1 }),
        snap({ phase: 'finished', timeLeftSec: 0 })
      )
    ).toEqual(['end']);
  });

  it('suppresses scheduled cues while paused', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'work', timeLeftSec: 121 }),
        snap({ phase: 'work', timeLeftSec: 120, isPaused: true })
      )
    ).toEqual([]);
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 4 }),
        snap({ phase: 'setup', timeLeftSec: 3, isPaused: true })
      )
    ).toEqual([]);
  });

  it('does not startle a joiner landing mid-work on a minute boundary', () => {
    expect(
      selectTacticalCue(null, snap({ phase: 'work', timeLeftSec: 120 }))
    ).toEqual([]);
  });

  it('does not replay the same remaining second', () => {
    expect(
      selectTacticalCue(
        snap({ phase: 'setup', timeLeftSec: 3 }),
        snap({ phase: 'setup', timeLeftSec: 3 })
      )
    ).toEqual([]);
  });
});
