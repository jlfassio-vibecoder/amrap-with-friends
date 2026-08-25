import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import IntakePage from './IntakePage';

const saveMock = vi.fn();

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: null,
    missing: true,
    loading: false,
    error: null,
    save: saveMock,
  }),
}));

afterEach(() => {
  cleanup();
  saveMock.mockReset();
});

function renderIntake() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <IntakePage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('IntakePage', () => {
  it('shows the prove-it disclaimer under Operator and Special Ops', () => {
    renderIntake();
    const warnings = screen.getAllByText(/Claiming this rank does not grant it/);
    expect(warnings).toHaveLength(2);
  });

  it('defaults to imperial labels and disables submit until biometrics and a rank are set', () => {
    renderIntake();
    expect(screen.getByLabelText(/Height \(in\)/)).toBeTruthy();
    expect(screen.getByLabelText(/Weight \(lb\)/)).toBeTruthy();

    const submit = screen.getByRole('button', { name: 'File the dossier' });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/Height \(in\)/), {
      target: { value: '71' },
    });
    fireEvent.change(screen.getByLabelText(/Weight \(lb\)/), {
      target: { value: '176' },
    });
    fireEvent.change(screen.getByLabelText(/^Age$/), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'CIVILIAN' }));
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    expect(submit).toHaveProperty('disabled', false);
  });

  it('converts imperial input to metric on save', async () => {
    saveMock.mockResolvedValue({ error: null });
    renderIntake();

    fireEvent.change(screen.getByLabelText(/Height \(in\)/), {
      target: { value: '71' },
    });
    fireEvent.change(screen.getByLabelText(/Weight \(lb\)/), {
      target: { value: '176.4' },
    });
    fireEvent.change(screen.getByLabelText(/^Age$/), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: 'CIVILIAN' }));
    fireEvent.click(screen.getByRole('button', { name: 'File the dossier' }));

    await vi.waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          heightCm: 180,
          weightKg: 80,
          biologicalSex: 'M',
          perceivedClassification: 'civilian',
        })
      );
    });
  });

  it('converts fields in place when toggling unit systems', () => {
    renderIntake();

    fireEvent.change(screen.getByLabelText(/Height \(in\)/), {
      target: { value: '70' },
    });
    fireEvent.change(screen.getByLabelText(/Weight \(lb\)/), {
      target: { value: '176.4' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'cm / kg' }));

    expect(screen.getByLabelText(/Height \(cm\)/)).toHaveProperty('value', '178');
    expect(screen.getByLabelText(/Weight \(kg\)/)).toHaveProperty('value', '80');

    fireEvent.click(screen.getByRole('button', { name: 'in / lb' }));

    expect(screen.getByLabelText(/Height \(in\)/)).toHaveProperty('value', '70');
    expect(screen.getByLabelText(/Weight \(lb\)/)).toHaveProperty('value', '176.4');
  });
});
