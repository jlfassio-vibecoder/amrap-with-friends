/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Set to false to hide magic-link sign-in until custom SMTP (e.g. Resend) is configured. */
  readonly VITE_AUTH_MAGIC_LINK_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
