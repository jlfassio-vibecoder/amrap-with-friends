import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkoutTemplatePicker } from './WorkoutTemplatePicker';

afterEach(() => {
  cleanup();
});

function renderPicker(overrides: Partial<Parameters<typeof WorkoutTemplatePicker>[0]> = {}) {
  return render(
    <WorkoutTemplatePicker
      durationMinutes={5}
      selectedCategory="blood-shunt"
      selectedTemplateId={null}
      smartRecoveryEnabled={false}
      onSmartRecoveryEnabledChange={() => undefined}
      recoveryLocks={new Map()}
      smartRecoveryActive={false}
      isAuthenticated={false}
      onDurationChange={() => undefined}
      onCategoryChange={() => undefined}
      onTemplateSelect={() => undefined}
      {...overrides}
    />
  );
}

describe('WorkoutTemplatePicker', () => {
  it('puts an icon-only style guide control inside each category chip', () => {
    renderPicker();

    expect(screen.queryByText('Guide')).toBeNull();
    const bloodShuntInfo = screen.getByRole('button', { name: "What's Blood Shunt?" });
    expect(bloodShuntInfo.textContent).toBe('?');
    fireEvent.click(bloodShuntInfo);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('disables time domain and category chips while searching', () => {
    renderPicker();

    const fiveMin = screen.getByRole('button', { name: '5 min' });
    expect(fiveMin.hasAttribute('disabled')).toBe(false);

    fireEvent.change(screen.getByLabelText('Search missions'), {
      target: { value: 'Shield' },
    });

    expect(screen.getByRole('button', { name: '5 min' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Blood Shunt' }).hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('Searching all missions — clear search to use time domain and category.')
    ).toBeTruthy();
    expect(screen.getByText('The Shield')).toBeTruthy();
  });

  it('filters the list when an intensity chip is pressed', () => {
    renderPicker({
      durationMinutes: 20,
      selectedCategory: 'armor-protocol',
    });

    const intensityGroup = screen.getByRole('group', { name: 'Intensity' });
    fireEvent.click(within(intensityGroup).getByRole('button', { name: 'I5' }));

    expect(screen.getByText('Iron Will')).toBeTruthy();
    expect(screen.getByText('The Shield')).toBeTruthy();
    expect(screen.getByText('The Trench')).toBeTruthy();
    expect(screen.queryByText('The Phalanx')).toBeNull();
  });
});
