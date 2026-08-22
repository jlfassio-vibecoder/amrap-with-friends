import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AmrapAuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AmrapAuthContext = createContext<AmrapAuthContextValue | null>(null);
