import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const { sendContentEvent } = vi.hoisted(() => ({ sendContentEvent: vi.fn() }));
vi.mock('@/lib/analytics/contentBeacon', () => ({ sendContentEvent }));
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import PacingCalculator from './PacingCalculator';

function type(value: string) {
  fireEvent.change(screen.getByLabelText(/your round times/i), { target: { value } });
}

function setCap(minutes: string) {
  fireEvent.change(screen.getByLabelText(/time cap/i), { target: { value: minutes } });
}

describe('PacingCalculator', () => {
  afterEach(cleanup);

  it('scores even splits as low variability', () => {
    render(<PacingCalculator />);
    setCap('5');
    type('1:00 1:00 1:00');
    expect(screen.getByText('0.0% variability')).toBeTruthy();
    expect(screen.getByText('Elite Pacing')).toBeTruthy();
  });

  it('drops the first round on every cap except the shortest', () => {
    render(<PacingCalculator />);
    // A fast opener followed by three identical rounds: excluded, the spread is zero.
    type('0:30 1:00 1:00 1:00');
    setCap('15');
    expect(screen.getByText('0.0% variability')).toBeTruthy();
    // 7 minutes is in the same domain as 10 and behaves the same way, which the
    // old `>= 10` rule got wrong.
    setCap('7');
    expect(screen.getByText('0.0% variability')).toBeTruthy();
    setCap('5');
    expect(screen.getByText('57.1% variability')).toBeTruthy();
  });

  it('names what it could not read instead of ignoring it', () => {
    render(<PacingCalculator />);
    type('1:00 oops 1:10 1:20');
    expect(screen.getByText(/could not read/i)).toBeTruthy();
    expect(screen.getByText('oops')).toBeTruthy();
  });

  it('asks for more rounds rather than scoring one', () => {
    render(<PacingCalculator />);
    setCap('5');
    type('1:00');
    expect(screen.getByText(/enter at least two round times/i)).toBeTruthy();
  });
});

describe('PacingCalculator conversion path', () => {
  beforeEach(() => {
    sendContentEvent.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('offers a way into the app', () => {
    // The page previously had no link into the product at all.
    render(<PacingCalculator />);
    expect(screen.getByRole('link', { name: /plan a mission/i }).getAttribute('href')).toBe(
      '/plan-mission'
    );
  });

  it('does not report a score for the prefilled example', () => {
    render(<PacingCalculator />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      sendContentEvent.mock.calls.filter(([name]) => name === 'pacing_calculator_scored')
    ).toHaveLength(0);
  });

  it('reports once when the reader enters their own splits', () => {
    render(<PacingCalculator />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '1:04 1:09 1:11 1:15' } });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.change(input, { target: { value: '1:04 1:09 1:11 1:16' } });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const scored = sendContentEvent.mock.calls.filter(
      ([name]) => name === 'pacing_calculator_scored'
    );
    expect(scored).toHaveLength(1);
    expect(scored[0]?.[1]).toMatchObject({ round_count: expect.any(Number) });
  });

  it('does not report while the reader is still typing', () => {
    render(<PacingCalculator />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1:04 1:09 1:11' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(
      sendContentEvent.mock.calls.filter(([name]) => name === 'pacing_calculator_scored')
    ).toHaveLength(0);
  });
});
