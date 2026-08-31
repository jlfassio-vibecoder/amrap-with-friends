import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import FreeAmrapTimer from './FreeAmrapTimer';

function press(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function clock(): string {
  return screen.getByRole('timer').textContent ?? '';
}

function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

describe('FreeAmrapTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens on a twenty minute cap with no rounds logged', () => {
    render(<FreeAmrapTimer />);
    expect(clock()).toBe('20:00');
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('counts down once started', () => {
    render(<FreeAmrapTimer />);
    press(/^start$/i);
    advance(65);
    expect(clock()).toBe('18:55');
  });

  it('changing the cap while stopped resets the clock to the new cap', () => {
    render(<FreeAmrapTimer />);
    press(/^5 min$/i);
    expect(clock()).toBe('05:00');
  });

  it('stops at zero rather than running negative', () => {
    render(<FreeAmrapTimer />);
    press(/^5 min$/i);
    press(/^start$/i);
    advance(5 * 60 + 30);
    expect(clock()).toBe('00:00');
    expect(screen.getByRole('button', { name: /^start$/i })).toHaveProperty('disabled', true);
  });

  it('only counts rounds while the clock is running', () => {
    render(<FreeAmrapTimer />);
    expect(screen.getByRole('button', { name: /log round/i })).toHaveProperty('disabled', true);
    press(/^start$/i);
    press(/log round/i);
    press(/log round/i);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('reset returns both the clock and the round count', () => {
    render(<FreeAmrapTimer />);
    press(/^start$/i);
    advance(30);
    press(/log round/i);
    press(/^reset$/i);
    expect(clock()).toBe('20:00');
    expect(screen.getByText('0')).toBeTruthy();
  });
});
