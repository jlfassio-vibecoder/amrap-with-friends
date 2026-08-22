import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import {
  AmrapAuthContext,
  type AmrapAuthContextValue,
} from '@/contexts/AmrapAuthContext';

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

      if (!initialResolved && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) {
        initialResolved = true;
        setIsAuthLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const trimmed = email.trim();
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
      signOut,
    }),
    [user, session, isAuthLoading, signInWithMagicLink, signOut]
  );

  return (
    <AmrapAuthContext.Provider value={value}>{children}</AmrapAuthContext.Provider>
  );
}
