import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DailyTelemetry } from './DailyTelemetry';

afterEach(() => {
  cleanup();
});

describe('DailyTelemetry', () => {
  it('shows NEVER and no-lock copy when lastLockedAt is null', () => {
    render(<DailyTelemetry lastLockedAt={null} />);

    expect(screen.getByText('NEVER')).toBeDefined();
    expect(screen.getByText('NO LOCK ON RECORD')).toBeDefined();
  });
});
