import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!url || !anonKey)) {
  console.warn(
    'AMRAP With Friends: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env'
  );
}

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '');
