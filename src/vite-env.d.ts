/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Magic-link sign-in. Defaults to false; on, now that Resend SMTP is configured. */
  readonly VITE_AUTH_MAGIC_LINK_ENABLED?: string;
  /** Forgot password + /reset-password. Defaults to false; needs /reset-password in the Auth redirect allow-list. */
  readonly VITE_AUTH_PASSWORD_RESET_ENABLED?: string;
  /** Set to true to show Continue with Google after Google Cloud + Supabase Google provider are configured. */
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
