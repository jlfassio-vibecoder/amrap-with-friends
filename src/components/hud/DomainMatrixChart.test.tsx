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
        domainMinutes30d={{ 5: 0, 10: 0, 15: 0, 20: 0, other: 0 }}
      />
    );

    expect(screen.getByText(/no locked core-domain volume/i)).toBeDefined();
    expect(screen.queryByText(/System Warning/i)).toBeNull();
  });

  it('shows Marathon warning when sprint domain dominates', () => {
    render(
      <DomainMatrixChart
        domainMinutes30d={{ 5: 120, 10: 10, 15: 10, 20: 10, other: 0 }}
      />
    );

    expect(
      screen.getByText(
        'System Warning: Imbalanced Load. 20-Minute Marathon required.'
      )
    ).toBeDefined();
  });
});
