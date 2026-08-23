import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function readSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function getSupabaseConfigError(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (url && anonKey) {
    return null;
  }

  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  return (
    `Supabase env missing: ${missing.join(', ')}. In the project root .env file use ` +
    'VITE_SUPABASE_URL=https://<project-ref>.supabase.co and VITE_SUPABASE_ANON_KEY=<anon key> ' +
    '(no quotes, no spaces around =). Restart npm run dev after saving.'
  );
}

export function getSupabaseClient(): SupabaseClient {
  const config = readSupabaseEnv();
  if (!config) {
    throw new Error(getSupabaseConfigError() ?? 'Supabase is not configured.');
  }

  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

/** Lazy Supabase client — only initializes when first used (e.g. create/join RPC). */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

if (import.meta.env.DEV && getSupabaseConfigError()) {
  console.warn(`AMRAP With Friends: ${getSupabaseConfigError()}`);
}
