import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { findAmqapFlow } from '@/data/amqapFlows';

vi.mock('@/components/mission/AmqapGauge', () => ({
  AmqapGauge: () => {
    throw new Error('gauge blew up');
  },
}));

const { MissionAmqapGauge } = await import('@/components/mission/MissionAmqapGauge');

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const flow = findAmqapFlow('amqap-foundational-10')!;

function MissionLike() {
  return (
    <div>
      <p>4:37</p>
      <MissionAmqapGauge
        phase="work"
        flow={flow}
        roundSplitsSec={[]}
        elapsedSec={10}
        isPaused={false}
      />
      <button type="button">Log round</button>
    </div>
  );
}

describe('a throwing AMQAP gauge at its real mount point', () => {
  it('does not take the clock or Log round with it', () => {
    render(<MissionLike />);
    expect(document.body.textContent).toContain('4:37');
    expect(document.body.textContent).toContain('Log round');
  });
});
