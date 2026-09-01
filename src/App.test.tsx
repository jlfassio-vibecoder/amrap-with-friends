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
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
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
    // /create renders FeaturedWodCard as its signed-out preview, and that
    // fetches unconditionally — mock rpc so the call resolves instead of
    // throwing "supabase.rpc is not a function".
    rpc: vi.fn(() => Promise.resolve({ data: { ok: true, featured: null }, error: null })),
  },
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AmrapAuthProvider>
          <App />
        </AmrapAuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('App', () => {
  // `/` is no longer an app route: Astro builds the home page and the SPA is
  // never served there, so this is what the router does with anything it does
  // not own. It exercises Routes, the lazy boundary and the catch-all together.
  it('renders the not-found page for a path the SPA does not serve', async () => {
    renderAt('/not-a-real-page');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeDefined();
  });
});
