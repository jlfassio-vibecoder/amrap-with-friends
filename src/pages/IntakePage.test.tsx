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

  it('disables submit until biometrics and a rank are set', () => {
    renderIntake();
    const submit = screen.getByRole('button', { name: 'File the dossier' });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/Height/), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/^Age$/), { target: { value: '32' } });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'CIVILIAN' }));
    expect(submit).toHaveProperty('disabled', false);
  });
});
