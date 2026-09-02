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

export interface AuthUpdateEmailResult {
  error: string | null;
  /** True when Supabase accepted the change but requires email re-confirmation. */
  needsEmailConfirmation: boolean;
}

export interface AuthUpdatePasswordResult {
  error: string | null;
}

export interface AmrapAuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /** True during password recovery (PASSWORD_RECOVERY event or restored sessionStorage flag). */
  isPasswordRecovery: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthSignUpResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthSignInResult>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updateEmail: (email: string) => Promise<AuthUpdateEmailResult>;
  updatePassword: (password: string) => Promise<AuthUpdatePasswordResult>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

export const AmrapAuthContext = createContext<AmrapAuthContextValue | null>(null);
