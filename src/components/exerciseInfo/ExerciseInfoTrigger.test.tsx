import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseInfoTrigger } from './ExerciseInfoTrigger';

afterEach(() => {
  cleanup();
});

describe('ExerciseInfoTrigger', () => {
  it('renders nothing when no library entry exists', () => {
    const { container } = render(<ExerciseInfoTrigger name="Totally Fake Movement" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an info button for Burpees', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    expect(screen.getByRole('button', { name: 'How to do Burpees' })).toBeTruthy();
  });

  it('opens the modal showing setup steps, sequence photo, and empty video', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'How to do Burpees' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Burpees' })).toBeTruthy();
    expect(screen.getByText(/Drop into a squat, plant hands, and jump feet back/)).toBeTruthy();
    expect(screen.getByText('Common mistakes')).toBeTruthy();
    expect(screen.getByText('AMRAP tip')).toBeTruthy();
    expect(screen.queryByText('No photos yet')).toBeNull();
    expect(screen.getByRole('img', { name: 'Burpees' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Video' }));
    expect(screen.getByText('No video yet')).toBeTruthy();
  });

  // This used to assert the section was hidden, back when 72 of 73 entries had
  // no common mistakes. Every entry has them now, and a test enforces it, so the
  // empty branch is unreachable with real library data.
  it('shows AMRAP tip and common mistakes for Air Squats', () => {
    render(<ExerciseInfoTrigger name="Air Squats" />);
    fireEvent.click(screen.getByRole('button', { name: 'How to do Air Squats' }));

    expect(screen.getByText('Common mistakes')).toBeTruthy();
    expect(screen.getByText(/Cutting the depth once the legs burn/)).toBeTruthy();
    expect(screen.getByText('AMRAP tip')).toBeTruthy();
    expect(screen.getByText(/Let gravity do the work on the way down/)).toBeTruthy();
  });

  it('resolves parenthetical movement names for the trigger', () => {
    render(<ExerciseInfoTrigger name="Commando Planks (Up-Downs)" />);
    expect(screen.getByRole('button', { name: 'How to do Commando Planks' })).toBeTruthy();
  });

  it('closes the modal via the Close button', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'How to do Burpees' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal via Escape', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'How to do Burpees' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal via backdrop click', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'How to do Burpees' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
