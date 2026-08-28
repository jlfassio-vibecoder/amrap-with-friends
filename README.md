# AMRAP With Friends

AMRAP With Friends is a standalone web app for running social AMRAP (As Many Rounds As Possible) workout sessions with friends in real time. This repository is a from-scratch rebuild focused on a single, self-contained experience—create or join a session, sync the timer, and track rounds together.

## Local development

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm run dev
```

The dev server runs at [http://localhost:5173](http://localhost:5173).

### Other scripts

| Command | Description |
|---|---|
| `npm run build` | Type-check and production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project references build |
| `npm run test` | Vitest (single run) |
| `npm run format` | Prettier |
| `npm run seed:exercise-media` | Manual: seed empty `exercise-media/{id}/.keep` folders in Supabase Storage |

### Seed exercise-media folders (manual)

When you add exercises to [`src/data/exerciseLibrary.ts`](src/data/exerciseLibrary.ts) and want empty folders visible in the Supabase Storage dashboard before uploading real photos/video:

1. Put `SUPABASE_SERVICE_ROLE_KEY` in `.env` (never prefix with `VITE_`).
2. Run `npm run seed:exercise-media` once from your machine.

The script reads `EXERCISE_LIBRARY` directly and upserts `${id}/.keep` placeholders. It is **not** part of the app runtime or CI — re-run only when new exercise ids appear.

Upload sequence stills as **`{exerciseId}/sequence.jpeg`** or **`{exerciseId}/sequence.png`** in the `exercise-media` bucket (Gemini → `.jpeg`, ChatGPT → `.png`). The library defaults to `.jpeg`; the info modal falls back across `.jpeg` / `.png` / `.jpg` if the first path 404s.

## Supabase migrations

Lobby schema and RPCs live in [`supabase/migrations/`](supabase/migrations/). Apply with the Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor. Use a service-role key only on your machine for admin tasks—never in the client or `.env` bundled with the app.

Manual RPC checks: [`supabase/scripts/verify_lobby_rpc.sql`](supabase/scripts/verify_lobby_rpc.sql).

### Hosted Supabase deploy (required for score lock at session finish)

After linking the project (`supabase link --project-ref <ref>`):

```bash
supabase db push
supabase functions deploy submit-participant-result
```

`submit-participant-result` must be deployed or finishing a workout (partial reps / **I EARNED THIS**) fails with a CORS or network error. If claim-status RPCs 404, run `supabase db push` so repair migrations (e.g. `get_participant_claim_status`) are applied.

### Auth (manual verification)

Enable Supabase Auth **email** provider and redirect URLs for your dev origin (e.g. `http://localhost:5173`). Sign-in options: **magic link** or **email + password**. Set `VITE_AUTH_MAGIC_LINK_ENABLED=false` in `.env` (and Vercel) to hide magic link until custom SMTP (e.g. Resend) is configured.

**Hosted vs local auth settings:** Local `supabase/config.toml` sets `enable_confirmations = false` and `minimum_password_length = 6`. The hosted dashboard may differ (Confirm email is often ON by default; password minimum may change). Before shipping to prod, check Dashboard → **Authentication → Providers → Email** and align [`AUTH_MIN_PASSWORD_LENGTH`](src/lib/auth/passwordPolicy.ts) with the hosted minimum if needed.

After `supabase db push` for `20260822140000_auth_claim.sql`:

1. Play a session as guest, finish, sign in (magic link or password), click **Save this session to my account**.
2. Open **My sessions** — saved session appears with round count.
3. Optional: sign in mid-session, save, then **Log round** still works after claim.
4. Password sign-up: if email confirmation is enabled on hosted, UI should prompt to check email; local dev may sign in immediately.

**Follow-up (out of scope):** forgot-password / password reset flow.

## Architecture decisions

This project is a deliberate from-scratch rebuild of the AMRAP With Friends experience from the interval-timers monorepo. Several features from the reference app are **intentionally excluded**:

- **Tabata timer** support
- **Embed module** and Trainer-Live-specific options
- **WorkoutExplorer** marketing page
- **Hub/handoff** activation tracking across multiple hosted timer apps

The app is fully standalone—not embeddable into another product. Supabase integration uses `@supabase/supabase-js` only (`createClient`); `@supabase/ssr` and cross-subdomain cookie auth are omitted until multi-subdomain auth is actually needed.
