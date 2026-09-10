import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BenchmarkProgressPanel } from '@/components/mission/BenchmarkProgressPanel';
import type { AthleteBenchmark } from '@/lib/api/benchmarks';
import type { AttemptCandidate } from '@/lib/benchmark/benchmarkAttempts';

afterEach(cleanup);

const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const BENCHMARK: AthleteBenchmark = {
  id: 'b1',
  templateId: 'the-valve',
  durationMinutes: 10,
  timeDomain: 10,
  versionKey: '',
  movementVariants: {},
  designatedAt: daysAgo(90),
  retiredAt: null,
};

function run(overrides: Partial<AttemptCandidate> & { missionId: string }): AttemptCandidate {
  return {
    templateId: 'the-valve',
    durationMinutes: 10,
    createdAt: daysAgo(60),
    scheduledAt: null,
    finalScore: 142,
    modifiedMovements: [],
    movementVariants: {},
    ...overrides,
  };
}

function renderPanel(benchmarks: AthleteBenchmark[], missions: AttemptCandidate[]) {
  return render(
    <MemoryRouter>
      <BenchmarkProgressPanel benchmarks={benchmarks} missions={missions} now={NOW} />
    </MemoryRouter>
  );
}

describe('BenchmarkProgressPanel', () => {
  it('renders nothing until something is designated', () => {
    const { container } = renderPanel([], []);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when every benchmark is retired', () => {
    const { container } = renderPanel([{ ...BENCHMARK, retiredAt: daysAgo(1) }], []);
    expect(container.innerHTML).toBe('');
  });

  it('shows the series with the absolute and percent change', () => {
    renderPanel(
      [BENCHMARK],
      [
        run({ missionId: 'm1', createdAt: daysAgo(60), finalScore: 142 }),
        run({ missionId: 'm2', createdAt: daysAgo(20), finalScore: 156 }),
      ]
    );
    expect(screen.getByText('142 → 156 reps')).toBeTruthy();
    // +14 means nothing without knowing whether the score was 40 or 400.
    expect(screen.getByText('+14 (+9.9%)')).toBeTruthy();
  });

  it('calls one attempt a first attempt, not a trend', () => {
    renderPanel([BENCHMARK], [run({ missionId: 'm1', finalScore: 310 })]);
    expect(screen.getByText('first attempt')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('reports a decline rather than hiding it', () => {
    renderPanel(
      [BENCHMARK],
      [
        run({ missionId: 'm1', createdAt: daysAgo(60), finalScore: 200 }),
        run({ missionId: 'm2', createdAt: daysAgo(20), finalScore: 180 }),
      ]
    );
    expect(screen.getByText('−20 (−10%)')).toBeTruthy();
  });

  it('offers a retest once it is due, deep-linked to the benchmark', () => {
    // Both gates: 60 days since the attempt, and eight missions trained since.
    const since = Array.from({ length: 8 }, (_, index) =>
      run({
        missionId: `since-${index}`,
        templateId: 'equilibrium',
        createdAt: daysAgo(30 - index),
      })
    );
    renderPanel([BENCHMARK], [run({ missionId: 'm1', createdAt: daysAgo(60) }), ...since]);
    expect(screen.getByText('Retest due')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retest' }).getAttribute('href')).toBe(
      '/create?benchmark=b1'
    );
  });

  it('offers no retest link while the athlete is still waiting', () => {
    renderPanel([BENCHMARK], [run({ missionId: 'm1', createdAt: daysAgo(3) })]);
    expect(screen.getByText(/Retest in \d+ days/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Retest' })).toBeNull();
  });

  it('says to train more when time has passed but training has not', () => {
    // Forty days and no missions since is not four weeks of training.
    renderPanel([BENCHMARK], [run({ missionId: 'm1', createdAt: daysAgo(40) })]);
    expect(screen.getByText('Retest in 8 missions')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Retest' })).toBeNull();
  });

  it('asks for a baseline when the benchmark has never been run', () => {
    renderPanel([BENCHMARK], []);
    expect(screen.getByText(/Run it to set your baseline/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Run it' })).toBeTruthy();
  });

  it('says why a run of the same workout did not count', () => {
    renderPanel(
      [BENCHMARK],
      [
        run({ missionId: 'm1', createdAt: daysAgo(60), finalScore: 142 }),
        run({
          missionId: 'm2',
          createdAt: daysAgo(20),
          finalScore: 180,
          modifiedMovements: ['Diamond Push-ups'],
          movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
        }),
      ]
    );
    expect(screen.getByText(/1 other run of this workout was performed differently/)).toBeTruthy();
    // And it stays out of the series entirely.
    expect(screen.getByText('142 reps')).toBeTruthy();
  });

  it('names the modification a modified benchmark measures', () => {
    renderPanel(
      [
        {
          ...BENCHMARK,
          versionKey: 'Diamond Push-ups#push-up--knees',
          movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
        },
      ],
      []
    );
    expect(screen.getByText('Diamond Push-ups: from the knees')).toBeTruthy();
  });

  it('counts a campaign slot in the header and says which campaign holds it', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[BENCHMARK]}
          missions={[]}
          campaignSlots={[
            {
              domain: 20,
              source: 'campaign',
              templateId: 'the-pacer',
              durationMinutes: 20,
              campaignName: '8-week Blood Shunt',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('2 of 3 active')).toBeTruthy();
    expect(screen.getByText(/Held by 8-week Blood Shunt/)).toBeTruthy();
  });

  it('renders for an athlete whose only slot is a campaign', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[]}
          campaignSlots={[
            {
              domain: 20 as const,
              source: 'campaign' as const,
              templateId: 'the-pacer',
              durationMinutes: 20,
              campaignName: 'Winter',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('1 of 3 active')).toBeTruthy();
  });

  it('warns that a test under high load reads as fatigue, without blocking it', () => {
    const since = Array.from({ length: 8 }, (_, index) =>
      run({ missionId: `s${index}`, templateId: 'equilibrium', createdAt: daysAgo(30 - index) })
    );
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[BENCHMARK]}
          missions={[run({ missionId: 'm1', createdAt: daysAgo(60) }), ...since]}
          riskLevel="high"
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/fatigue as much as fitness/)).toBeTruthy();
    // A caveat, never a gate: the retest is still one tap away.
    expect(screen.getByRole('link', { name: 'Retest' })).toBeTruthy();
  });

  it('stays quiet about readiness when the load is ordinary', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[BENCHMARK]}
          missions={[]}
          riskLevel="normal"
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.queryByText(/fatigue as much as fitness/)).toBeNull();
  });

  it('shows a campaign benchmark’s own scores, not just that a slot is taken', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[
            run({
              missionId: 'w1',
              templateId: 'the-hemodynamic',
              createdAt: daysAgo(60),
              finalScore: 142,
            }),
            run({
              missionId: 'w8',
              templateId: 'the-hemodynamic',
              createdAt: daysAgo(5),
              finalScore: 168,
            }),
          ]}
          campaignSlots={[
            {
              domain: 10,
              source: 'campaign',
              templateId: 'the-hemodynamic',
              durationMinutes: 10,
              campaignName: '8-week Blood Shunt',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('142 → 168 reps')).toBeTruthy();
    expect(screen.getByText('+26 (+18.3%)')).toBeTruthy();
    expect(screen.getByText(/Held by 8-week Blood Shunt/)).toBeTruthy();
  });

  it('offers no retest on a campaign benchmark — the campaign schedules it', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[
            run({
              missionId: 'w1',
              templateId: 'the-hemodynamic',
              createdAt: daysAgo(90),
              finalScore: 142,
            }),
          ]}
          campaignSlots={[
            {
              domain: 10,
              source: 'campaign',
              templateId: 'the-hemodynamic',
              durationMinutes: 10,
              campaignName: 'Winter',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );

    // Ninety days would be long overdue for a personal benchmark. Offering a
    // Retest here would open a mission the campaign calendar knows nothing of.
    expect(screen.queryByRole('link', { name: 'Retest' })).toBeNull();
    expect(screen.queryByText(/Retest due/)).toBeNull();
  });

  it('prints a campaign benchmark’s real clock, not its domain', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[]}
          campaignSlots={[
            {
              domain: 15,
              source: 'campaign',
              templateId: 'the-equalizer',
              durationMinutes: 12,
              campaignName: 'Winter',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/· 12 min/)).toBeTruthy();
    expect(screen.queryByText(/· 15 min/)).toBeNull();
  });

  it('says a campaign benchmark has no attempt yet rather than inventing one', () => {
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[]}
          campaignSlots={[
            {
              domain: 10,
              source: 'campaign',
              templateId: 'the-hemodynamic',
              durationMinutes: 10,
              campaignName: 'Winter',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('No attempt yet')).toBeTruthy();
  });

  it('counts occupied domains, not rows, when two campaigns share a clock', () => {
    // Nothing stops two live campaigns testing at ten minutes. Counting rows
    // would say "2 of 3" for one occupied domain — and with a personal
    // benchmark too, "3 of 3" to someone who can still designate at two other
    // clocks.
    const shared = (name: string, templateId: string) => ({
      domain: 10 as const,
      source: 'campaign' as const,
      templateId,
      durationMinutes: 10,
      campaignName: name,
    });

    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[]}
          campaignSlots={[shared('A', 'the-hemodynamic'), shared('B', 'equilibrium')]}
          now={NOW}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('1 of 3 active')).toBeTruthy();
    // Both campaigns are still real tests the athlete is running, so both show.
    expect(screen.getByText(/Held by A/)).toBeTruthy();
    expect(screen.getByText(/Held by B/)).toBeTruthy();
  });

  it('does not double-count a personal benchmark sitting in a campaign’s domain', () => {
    // The RPC cannot see campaigns, so a personal benchmark can predate a
    // campaign that later tests at the same clock.
    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[BENCHMARK]}
          missions={[]}
          campaignSlots={[
            {
              domain: 10,
              source: 'campaign',
              templateId: 'the-hemodynamic',
              durationMinutes: 10,
              campaignName: 'Winter',
            },
          ]}
          now={NOW}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('1 of 3 active')).toBeTruthy();
  });

  it('gives two campaigns at one clock distinct rows', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shared = (name: string, templateId: string) => ({
      domain: 10 as const,
      source: 'campaign' as const,
      templateId,
      durationMinutes: 10,
      campaignName: name,
    });

    render(
      <MemoryRouter>
        <BenchmarkProgressPanel
          benchmarks={[]}
          missions={[]}
          campaignSlots={[shared('A', 'the-hemodynamic'), shared('B', 'equilibrium')]}
          now={NOW}
        />
      </MemoryRouter>
    );

    const duplicateKey = errors.mock.calls.some((call) =>
      String(call[0]).includes('two children with the same key')
    );
    errors.mockRestore();
    expect(duplicateKey).toBe(false);
  });
});
