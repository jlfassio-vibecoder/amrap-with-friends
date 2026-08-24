import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthSignUpResult {
  error: string | null;
  /** True when signUp succeeded but no session was issued (email confirmation pending). */
  needsEmailConfirmation: boolean;
}

export interface AuthSignInResult {
  error: string | null;
}

export interface AmrapAuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthSignUpResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthSignInResult>;
  signOut: () => Promise<void>;
}

export const AmrapAuthContext = createContext<AmrapAuthContextValue | null>(null);
