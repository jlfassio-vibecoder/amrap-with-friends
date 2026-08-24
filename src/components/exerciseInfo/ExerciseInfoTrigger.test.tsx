import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseInfoTrigger } from './ExerciseInfoTrigger';

afterEach(() => {
  cleanup();
});

describe('ExerciseInfoTrigger', () => {
  it('renders nothing when no library entry exists', () => {
    const { container } = render(<ExerciseInfoTrigger name="Hollow Rocks" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an info button for Burpees', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    expect(screen.getByRole('button', { name: 'About Burpees' })).toBeTruthy();
  });

  it('opens the modal showing setup steps, sequence photo, and empty video', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Burpees' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Burpees' })).toBeTruthy();
    expect(
      screen.getByText(/Drop into a squat, plant hands, and jump feet back/)
    ).toBeTruthy();
    expect(screen.getByText('Common mistakes')).toBeTruthy();
    expect(screen.getByText('AMRAP tip')).toBeTruthy();
    expect(screen.queryByText('No photos yet')).toBeNull();
    expect(screen.getByRole('img', { name: 'Burpees' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Video' }));
    expect(screen.getByText('No video yet')).toBeTruthy();
  });

  it('shows AMRAP tip and hides empty common mistakes for Air Squats', () => {
    render(<ExerciseInfoTrigger name="Air Squats" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Air Squats' }));

    expect(screen.queryByText('Common mistakes')).toBeNull();
    expect(screen.getByText('AMRAP tip')).toBeTruthy();
    expect(
      screen.getByText(/Let gravity do the work on the way down/)
    ).toBeTruthy();
  });

  it('resolves parenthetical movement names for the trigger', () => {
    render(<ExerciseInfoTrigger name="Commando Planks (Up-Downs)" />);
    expect(screen.getByRole('button', { name: 'About Commando Planks' })).toBeTruthy();
  });

  it('closes the modal via the Close button', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Burpees' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal via Escape', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Burpees' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal via backdrop click', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Burpees' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
