import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { AmrapAuthProvider } from '@/contexts/AmrapAuthProvider';
import App from './App';

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  })),
  getSupabaseConfigError: vi.fn(() => null),
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

describe('App', () => {
  it('renders the home page heading', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AmrapAuthProvider>
            <App />
          </AmrapAuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'AMRAP With Friends' })).toBeDefined();
  });
});
