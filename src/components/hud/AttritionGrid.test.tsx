import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AttritionGrid } from './AttritionGrid';

afterEach(() => {
  cleanup();
});

describe('AttritionGrid', () => {
  it('renders 12 cells with compliant and deficient labels', () => {
    const attrition = Array.from({ length: 12 }, (_, index) => index === 11);

    render(
      <AttritionGrid
        attrition={attrition}
        weekEndsAt="2026-08-25T07:00:00.000Z"
      />
    );

    const cells = screen.getAllByLabelText(/Week of .*: (compliant|deficient)/);
    expect(cells).toHaveLength(12);
    expect(screen.getByLabelText(/: compliant$/)).toBeDefined();
    expect(screen.getAllByLabelText(/: deficient$/).length).toBe(11);
  });
});
