import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { AuthHeaderActions } from './AuthHeaderActions';

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthLoading: false,
  username: 'Coach' as string | null,
  signOut: vi.fn(),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: authState.isAuthLoading,
    user: authState.isAuthenticated ? { id: 'u1', email: 'coach@example.com' } : null,
    signOut: authState.signOut,
  }),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile:
      authState.isAuthenticated && authState.username ? { username: authState.username } : null,
    loading: false,
    error: null,
  }),
}));

vi.mock('@/components/AuthModal', () => ({
  AuthModal: ({ initialPasswordMode }: { initialPasswordMode?: string }) => (
    <div role="dialog" aria-label={`Auth ${initialPasswordMode ?? 'sign-in'}`}>
      Auth modal
    </div>
  ),
}));

function renderActions(initialPath = '/my-missions') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <AuthHeaderActions />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  authState.isAuthenticated = true;
  authState.isAuthLoading = false;
  authState.username = 'Coach';
  authState.signOut.mockReset();
});

describe('AuthHeaderActions', () => {
  it('opens the menu with signed-in destinations', () => {
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'HUD' })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'Plan' })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'Squad' })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'My missions' })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'Plan' }).getAttribute('href')).toBe(
      '/plan-mission'
    );
    expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('closes the drawer after choosing a nav link', () => {
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    fireEvent.click(within(menu).getByRole('link', { name: 'HUD' }));

    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
  });

  it('exposes Sign in and Create account in the guest drawer', () => {
    authState.isAuthenticated = false;
    authState.username = null;
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(within(menu).getByRole('button', { name: 'Create account' })).toBeTruthy();
  });

  it('closes the drawer on Escape', () => {
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
  });
});
