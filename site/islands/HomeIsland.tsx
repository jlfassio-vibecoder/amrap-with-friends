import type { ReactNode } from 'react';
import { AmrapAuthProvider } from '@/contexts/AmrapAuthProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';

/**
 * Providers for anything on the static home page that needs auth or the theme.
 *
 * Deliberately no Router. Components reached from here navigate with `AppLink`,
 * which renders a real anchor when there is no Router — a client-side route on a
 * page the SPA does not serve would go nowhere.
 */
export function HomeIsland({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AmrapAuthProvider>{children}</AmrapAuthProvider>
    </ThemeProvider>
  );
}
