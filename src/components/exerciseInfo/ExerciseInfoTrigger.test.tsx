import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseInfoTrigger } from './ExerciseInfoTrigger';

afterEach(() => {
  cleanup();
});

describe('ExerciseInfoTrigger', () => {
  it('renders nothing when no library entry exists', () => {
    const { container } = render(<ExerciseInfoTrigger name="Air Squats" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an info button for Burpees', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    expect(screen.getByRole('button', { name: 'About Burpees' })).toBeTruthy();
  });

  it('opens the modal showing setup steps and empty media states', () => {
    render(<ExerciseInfoTrigger name="Burpees" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Burpees' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Burpees' })).toBeTruthy();
    expect(
      screen.getByText('Stand with feet shoulder-width apart.')
    ).toBeTruthy();
    expect(screen.getByText('No photos yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Video' }));
    expect(screen.getByText('No video yet')).toBeTruthy();
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
