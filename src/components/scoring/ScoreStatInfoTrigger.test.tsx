import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScoreStatInfoTrigger } from '@/components/scoring/ScoreStatInfoTrigger';

afterEach(() => {
  cleanup();
});

describe('ScoreStatInfoTrigger', () => {
  it('renders an icon-only info button labelled for the stat', () => {
    render(<ScoreStatInfoTrigger statId="finalScore" />);
    const button = screen.getByRole('button', { name: 'What is Final score?' });
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('i');
  });

  it('opens a modal with the stat title as the heading', () => {
    render(<ScoreStatInfoTrigger statId="baseScore" />);
    fireEvent.click(screen.getByRole('button', { name: 'What is Base score?' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Base score' })).toBeTruthy();
  });

  it('shows the reference table for band-based stats and not for formula-based ones', () => {
    render(<ScoreStatInfoTrigger statId="pviMultiplier" />);
    fireEvent.click(screen.getByRole('button', { name: 'What is P.V.I. multiplier?' }));
    expect(screen.getByText('P.V.I. variance → multiplier')).toBeTruthy();
    expect(screen.getByText('Under 10%')).toBeTruthy();
    expect(screen.getByText('× 1.15')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    render(<ScoreStatInfoTrigger statId="baseScore" />);
    fireEvent.click(screen.getByRole('button', { name: 'What is Base score?' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('closes via Close, Escape, and a backdrop click', () => {
    render(<ScoreStatInfoTrigger statId="domainWeight" />);
    fireEvent.click(screen.getByRole('button', { name: 'What is Domain?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'What is Domain?' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'What is Domain?' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close when the card content itself is clicked', () => {
    render(<ScoreStatInfoTrigger statId="pviVariance" />);
    fireEvent.click(screen.getByRole('button', { name: 'What is P.V.I. variance?' }));
    fireEvent.click(screen.getByRole('heading', { name: 'P.V.I. variance' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('passes repsPerRound through to the Base score modal wording', () => {
    render(<ScoreStatInfoTrigger statId="baseScore" repsPerRound={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'What is Base score?' }));
    expect(screen.getByText('Volume — the total rounds you completed, nothing else.')).toBeTruthy();
    expect(screen.queryByText(/the total reps you completed/)).toBeNull();
  });
});
