import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DomainMatrixChart } from './DomainMatrixChart';

afterEach(() => {
  cleanup();
});

describe('DomainMatrixChart', () => {
  it('shows empty copy and no warning when core volume is zero', () => {
    render(
      <DomainMatrixChart
        domainMinutes30d={{ 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 0 }}
      />
    );

    expect(screen.getByText(/no locked core-domain volume/i)).toBeDefined();
    expect(screen.queryByText(/System Warning/i)).toBeNull();
  });

  it('heads each column with the range it counts, not the canonical minute', () => {
    // The 10 bucket now sums 7-, 8-, 9- and 10-minute missions. Heading it "10"
    // would report a number the athlete cannot reconcile with their own log.
    render(
      <DomainMatrixChart
        domainMinutes30d={{ 5: 10, 10: 10, 15: 10, 20: 10, other: 0, activeRecovery: 0 }}
      />
    );

    expect(screen.getByText('Sprint 3–5')).toBeDefined();
    expect(screen.getByText('Crucible 7–10')).toBeDefined();
    expect(screen.getByText('Grind 12–15')).toBeDefined();
    expect(screen.getByText('Marathon 18–25')).toBeDefined();
    expect(screen.getByText('Active Recovery')).toBeDefined();
  });

  it('shows Active Recovery minutes without treating them as core volume', () => {
    render(
      <DomainMatrixChart
        domainMinutes30d={{ 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 30 }}
      />
    );

    expect(screen.getByText('30 min')).toBeDefined();
    expect(screen.getByText(/only active recovery volume/i)).toBeDefined();
    expect(screen.queryByText(/System Warning/i)).toBeNull();
  });

  it('shows Marathon warning when sprint domain dominates', () => {
    render(
      <DomainMatrixChart
        domainMinutes30d={{ 5: 120, 10: 10, 15: 10, 20: 10, other: 0, activeRecovery: 40 }}
      />
    );

    expect(
      screen.getByText('System Warning: Imbalanced Load. 18–25-Minute Marathon required.')
    ).toBeDefined();
  });
});
