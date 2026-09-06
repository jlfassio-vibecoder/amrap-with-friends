import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
