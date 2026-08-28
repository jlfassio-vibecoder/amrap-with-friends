import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { validatePasswordLength } from '@/lib/auth/passwordPolicy';
import { isMagicLinkAuthEnabled } from '@/lib/auth/authFeatures';
import { getSupabaseClient } from '@/lib/supabase';
import {
  AmrapAuthContext,
  type AmrapAuthContextValue,
} from '@/contexts/AmrapAuthContext';

function trimEmail(email: string): string {
  return email.trim();
}

export function AmrapAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AmrapAuthContextValue['user']>(null);
  const [session, setSession] = useState<AmrapAuthContextValue['session']>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let initialResolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      // Resolve loading on the first auth event so UI is never stuck waiting for
      // INITIAL_SESSION alone (SIGNED_IN / TOKEN_REFRESHED can arrive first).
      if (!initialResolved) {
        initialResolved = true;
        setIsAuthLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
    const redirectTo = `${window.location.origin}${window.location.pathname}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      return { error: error.message };
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
    });

    if (error) {
      return { error: error.message, needsEmailConfirmation: false };
    }

    if (data.session) {
      return { error: null, needsEmailConfirmation: false };
    }

    if (data.user) {
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
      return { error: error.message };
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

    const pendingEmail =
      typeof data.user?.new_email === 'string' && data.user.new_email.length > 0;

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

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    (): AmrapAuthContextValue => ({
      user,
      session,
      isAuthLoading,
      isAuthenticated: user !== null,
      signInWithMagicLink,
      signUpWithPassword,
      signInWithPassword,
      updateEmail,
      updatePassword,
      signOut,
    }),
    [
      user,
      session,
      isAuthLoading,
      signInWithMagicLink,
      signUpWithPassword,
      signInWithPassword,
      updateEmail,
      updatePassword,
      signOut,
    ]
  );

  return (
    <AmrapAuthContext.Provider value={value}>{children}</AmrapAuthContext.Provider>
  );
}
