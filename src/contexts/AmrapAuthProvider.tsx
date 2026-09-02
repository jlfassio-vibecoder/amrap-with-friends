import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { validatePasswordLength } from '@/lib/auth/passwordPolicy';
import {
  isGoogleAuthEnabled,
  isMagicLinkAuthEnabled,
  isPasswordResetEnabled,
} from '@/lib/auth/authFeatures';
import { currentPathRedirectTo, passwordResetRedirectTo } from '@/lib/auth/authRedirect';
import { mapAuthError } from '@/lib/auth/mapAuthError';
import { getSupabaseClient } from '@/lib/supabase';
import { AmrapAuthContext, type AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';

function trimEmail(email: string): string {
  return email.trim();
}

/** Survives reload so /reset-password still works after PASSWORD_RECOVERY was already consumed. */
const PASSWORD_RECOVERY_STORAGE_KEY = 'amrap_password_recovery';

function readPasswordRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePasswordRecoveryFlag(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    }
  } catch {
    /* sessionStorage unavailable */
  }
}

export function AmrapAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AmrapAuthContextValue['user']>(null);
  const [session, setSession] = useState<AmrapAuthContextValue['session']>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let initialResolved = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const resolveLoading = () => {
      if (!initialResolved) {
        initialResolved = true;
        setIsAuthLoading(false);
      }
    };

    try {
      const supabase = getSupabaseClient();

      void supabase.auth
        .getSession()
        .then(({ data: { session: initialSession } }) => {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession && readPasswordRecoveryFlag()) {
            setIsPasswordRecovery(true);
          } else if (!initialSession) {
            writePasswordRecoveryFlag(false);
            setIsPasswordRecovery(false);
          }
          resolveLoading();
        })
        .catch(() => {
          setSession(null);
          setUser(null);
          writePasswordRecoveryFlag(false);
          setIsPasswordRecovery(false);
          resolveLoading();
        });

      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (event === 'PASSWORD_RECOVERY') {
          writePasswordRecoveryFlag(true);
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          writePasswordRecoveryFlag(false);
          setIsPasswordRecovery(false);
        }

        // Resolve loading on the first auth event so UI is never stuck waiting for
        // INITIAL_SESSION alone (SIGNED_IN / TOKEN_REFRESHED can arrive first).
        resolveLoading();
      });
      subscription = authSubscription;
    } catch {
      resolveLoading();
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!isMagicLinkAuthEnabled()) {
      return { error: 'Magic link sign-in is not available. Use email and password.' };
    }

    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: currentPathRedirectTo() },
    });

    if (error) {
      return { error: mapAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isGoogleAuthEnabled()) {
      return { error: 'Google sign-in is not available right now.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: currentPathRedirectTo(),
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      return { error: mapAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.', needsEmailConfirmation: false };
    }

    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error, needsEmailConfirmation: false };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: currentPathRedirectTo() },
    });

    if (error) {
      return { error: mapAuthError(error.message), needsEmailConfirmation: false };
    }

    if (data.session) {
      return { error: null, needsEmailConfirmation: false };
    }

    if (data.user) {
      if ((data.user.identities ?? []).length === 0) {
        return {
          error: mapAuthError('User already registered'),
          needsEmailConfirmation: false,
        };
      }
      return { error: null, needsEmailConfirmation: true };
    }

    return {
      error: 'Something went wrong. Please try again.',
      needsEmailConfirmation: false,
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      return { error: mapAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isPasswordResetEnabled()) {
      return { error: 'Password reset is not available right now.' };
    }

    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: passwordResetRedirectTo(),
    });

    if (error) {
      return { error: mapAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.', needsEmailConfirmation: false };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({ email: trimmed });

    if (error) {
      return { error: error.message, needsEmailConfirmation: false };
    }

    const pendingEmail = typeof data.user?.new_email === 'string' && data.user.new_email.length > 0;

    return {
      error: null,
      needsEmailConfirmation: pendingEmail,
    };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
  }, []);

  const value = useMemo(
    (): AmrapAuthContextValue => ({
      user,
      session,
      isAuthLoading,
      isAuthenticated: user !== null,
      isPasswordRecovery,
      signInWithMagicLink,
      signInWithGoogle,
      signUpWithPassword,
      signInWithPassword,
      requestPasswordReset,
      updateEmail,
      updatePassword,
      clearPasswordRecovery,
      signOut,
    }),
    [
      user,
      session,
      isAuthLoading,
      isPasswordRecovery,
      signInWithMagicLink,
      signInWithGoogle,
      signUpWithPassword,
      signInWithPassword,
      requestPasswordReset,
      updateEmail,
      updatePassword,
      clearPasswordRecovery,
      signOut,
    ]
  );

  return <AmrapAuthContext.Provider value={value}>{children}</AmrapAuthContext.Provider>;
}
