import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DomainMatrixChart } from './DomainMatrixChart';
import type { DomainMatrixWindowLabel } from '@/lib/hud/domainMatrixGuidance';

afterEach(() => {
  cleanup();
});

const empty = { 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 0 };

function renderChart(windowLabel: DomainMatrixWindowLabel, domainMinutes = empty) {
  return render(
    <MemoryRouter>
      <DomainMatrixChart domainMinutes={domainMinutes} windowLabel={windowLabel} />
    </MemoryRouter>
  );
}

describe('DomainMatrixChart', () => {
  it('shows empty copy and no warning when core volume is zero', () => {
    renderChart('30-day');

    expect(screen.getByText(/no locked core-domain volume in the last 30 days/i)).toBeDefined();
    expect(screen.getByLabelText('30-day domain matrix')).toBeDefined();
    expect(screen.queryByText(/System Warning/i)).toBeNull();
  });

  it('titles and empty copy use the 72-hour window', () => {
    renderChart('72-hour');

    expect(screen.getByLabelText('72-hour domain matrix')).toBeDefined();
    expect(screen.getByText(/no locked core-domain volume in the last 72 hours/i)).toBeDefined();
  });

  it('titles and empty copy use the 7-day window', () => {
    renderChart('7-day');

    expect(screen.getByLabelText('7-day domain matrix')).toBeDefined();
    expect(screen.getByText(/no locked core-domain volume in the last 7 days/i)).toBeDefined();
  });

  it('heads each column with the range it counts, not the canonical minute', () => {
    // The 10 bucket now sums 7-, 8-, 9- and 10-minute missions. Heading it "10"
    // would report a number the athlete cannot reconcile with their own log.
    renderChart('30-day', {
      5: 10,
      10: 10,
      15: 10,
      20: 10,
      other: 0,
      activeRecovery: 0,
    });

    expect(screen.getByText('Sprint 3–5')).toBeDefined();
    expect(screen.getByText('Crucible 7–10')).toBeDefined();
    expect(screen.getByText('Grind 12–15')).toBeDefined();
    expect(screen.getByText('Marathon 18–25')).toBeDefined();
    expect(screen.getByText('Active Recovery')).toBeDefined();
  });

  it('shows Active Recovery minutes without treating them as core volume', () => {
    renderChart('7-day', {
      5: 0,
      10: 0,
      15: 0,
      20: 0,
      other: 0,
      activeRecovery: 30,
    });

    expect(screen.getByText('30 min')).toBeDefined();
    expect(screen.getByText(/only active recovery volume in the last 7 days/i)).toBeDefined();
    expect(screen.queryByText(/System Warning/i)).toBeNull();
  });

  it('shows Marathon warning when sprint domain dominates', () => {
    renderChart('72-hour', {
      5: 120,
      10: 10,
      15: 10,
      20: 10,
      other: 0,
      activeRecovery: 40,
    });

    expect(
      screen.getByText('System Warning: Imbalanced Load. 18–25-Minute Marathon required.')
    ).toBeDefined();
  });

  it('opens 72-hour guidance about residual fatigue and diversifying', () => {
    renderChart('72-hour');

    fireEvent.click(screen.getByRole('button', { name: /What does 72-hour domain matrix mean/i }));

    expect(screen.getByText(/residual neuromuscular and metabolic fatigue/i)).toBeDefined();
    expect(screen.getByText(/prefer Active Recovery or a different core domain/i)).toBeDefined();
  });

  it('opens 7-day guidance about touching all four core formats', () => {
    renderChart('7-day');

    fireEvent.click(screen.getByRole('button', { name: /What does 7-day domain matrix mean/i }));

    expect(screen.getByText(/aim to touch all four core formats/i)).toBeDefined();
    expect(screen.getByText(/does not replace balance among the four core domains/i)).toBeDefined();
  });

  it('opens 30-day guidance about aerobic base plus high-intensity dose', () => {
    renderChart('30-day');

    fireEvent.click(screen.getByRole('button', { name: /What does 30-day domain matrix mean/i }));

    expect(screen.getByText(/lean toward sustained aerobic clocks/i)).toBeDefined();
    expect(screen.getByText(/literal 80\/20 zone split/i)).toBeDefined();
  });
});
