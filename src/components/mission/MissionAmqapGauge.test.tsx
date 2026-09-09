import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { findAmqapFlow } from '@/data/amqapFlows';
import { MissionAmqapGauge } from '@/components/mission/MissionAmqapGauge';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

afterEach(cleanup);

const flow = findAmqapFlow('amqap-foundational-10')!;

function renderAt(
  phase: LiveMissionPhase,
  overrides: Partial<Parameters<typeof MissionAmqapGauge>[0]> = {}
) {
  return render(
    <MissionAmqapGauge
      phase={phase}
      flow={flow}
      roundSplitsSec={[]}
      elapsedSec={10}
      isPaused={false}
      {...overrides}
    />
  );
}

describe('MissionAmqapGauge', () => {
  it('renders no focusable control during the mission', () => {
    const { container } = renderAt('work');
    expect(container.querySelectorAll('input, select, textarea, button')).toHaveLength(0);
  });

  it('stays off until work starts — no preference checkbox', () => {
    const { container } = renderAt('waiting');
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows the set caption during work, including practice', () => {
    renderAt('work');
    expect(screen.getByText('90/90 Hip Transitions · Left side')).toBeTruthy();
    cleanup();

    renderAt('work', { elapsedSec: 10 });
    expect(screen.getByRole('figure')).toBeTruthy();
  });

  it('shows nothing once the mission is over', () => {
    const { container } = renderAt('finished');
    expect(container.innerHTML).toBe('');
  });

  it('names overtime on the last set of the last exercise', () => {
    renderAt('work', { elapsedSec: 145, roundSplitsSec: [] });
    expect(screen.getByText('Downward-Facing Dog to Cobra')).toBeTruthy();
    expect(screen.getByText('Overtime')).toBeTruthy();
    expect(screen.getByText('+0:05')).toBeTruthy();
  });

  it('snaps the needle when a set resets', () => {
    renderAt('work', { elapsedSec: 25 });
    expect(screen.getByTestId('pacing-needle').style.transition).toBe('none');
    expect(screen.getByText('90/90 Hip Transitions · Right side')).toBeTruthy();
  });
});
