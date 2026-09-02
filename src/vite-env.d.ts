/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Set to false to hide magic-link sign-in until custom SMTP (e.g. Resend) is configured. */
  readonly VITE_AUTH_MAGIC_LINK_ENABLED?: string;
  /** Set to true to show Forgot password after custom SMTP and /reset-password allow-list are ready. */
  readonly VITE_AUTH_PASSWORD_RESET_ENABLED?: string;
  /** Set to true to show Continue with Google after Google Cloud + Supabase Google provider are configured. */
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
