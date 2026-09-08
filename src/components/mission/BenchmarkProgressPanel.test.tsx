import { afterEach, describe, expect, it } from 'vitest';
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
});
