import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import IntakePage from './IntakePage';

const saveMock = vi.fn();
const updateEmailMock = vi.fn();
const updatePasswordMock = vi.fn();

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1', email: 'athlete@example.com' },
    updateEmail: updateEmailMock,
    updatePassword: updatePasswordMock,
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
  updateEmailMock.mockReset();
  updatePasswordMock.mockReset();
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

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Email$/), {
    target: { value: 'athlete@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Username$/), {
    target: { value: 'ghost_ops' },
  });
  fireEvent.change(screen.getByLabelText(/^Nickname$/), {
    target: { value: 'Ghost' },
  });
  fireEvent.change(screen.getByLabelText(/Height \(in\)/), {
    target: { value: '71' },
  });
  fireEvent.change(screen.getByLabelText(/Weight \(lb\)/), {
    target: { value: '176' },
  });
  fireEvent.change(screen.getByLabelText(/^Age$/), { target: { value: '32' } });
  fireEvent.click(screen.getByRole('button', { name: 'Male' }));
  fireEvent.click(screen.getByRole('button', { name: 'CIVILIAN' }));
}

describe('IntakePage', () => {
  it('shows the prove-it disclaimer under Operator and Special Ops', () => {
    renderIntake();
    const warnings = screen.getAllByText(/Claiming this rank does not grant it/);
    expect(warnings).toHaveLength(2);
  });

  it('defaults to imperial labels and disables submit until account and biometrics are set', () => {
    renderIntake();
    expect(screen.getByLabelText(/Height \(in\)/)).toBeTruthy();
    expect(screen.getByLabelText(/Weight \(lb\)/)).toBeTruthy();
    expect(screen.getByLabelText(/^Email$/)).toHaveProperty(
      'value',
      'athlete@example.com'
    );

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
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/^Username$/), {
      target: { value: 'ghost_ops' },
    });
    fireEvent.change(screen.getByLabelText(/^Nickname$/), {
      target: { value: 'Ghost' },
    });
    expect(submit).toHaveProperty('disabled', false);
  });

  it('converts imperial input to metric on save and includes identity fields', async () => {
    saveMock.mockResolvedValue({ error: null });
    renderIntake();

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Weight \(lb\)/), {
      target: { value: '176.4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'File the dossier' }));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          heightCm: 180,
          weightKg: 80,
          biologicalSex: 'M',
          perceivedClassification: 'civilian',
          username: 'ghost_ops',
          nickname: 'Ghost',
        })
      );
    });
    expect(updateEmailMock).not.toHaveBeenCalled();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('updates email and password when changed', async () => {
    saveMock.mockResolvedValue({ error: null });
    updateEmailMock.mockResolvedValue({
      error: null,
      needsEmailConfirmation: false,
    });
    updatePasswordMock.mockResolvedValue({ error: null });
    renderIntake();

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/^Email$/), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/), {
      target: { value: 'newpass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'File the dossier' }));

    await waitFor(() => {
      expect(updateEmailMock).toHaveBeenCalledWith('new@example.com');
    });
    expect(updatePasswordMock).toHaveBeenCalledWith('newpass1');
  });

  it('shows a confirmation notice when email re-confirm is required', async () => {
    saveMock.mockResolvedValue({ error: null });
    updateEmailMock.mockResolvedValue({
      error: null,
      needsEmailConfirmation: true,
    });
    renderIntake();

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/^Email$/), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'File the dossier' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Check your inbox to confirm the new email address/)
      ).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
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
