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

Upload sequence stills as **`{exerciseId}/sequence.jpeg`** (`.jpeg`, not `.jpg`) in the `exercise-media` bucket. The library already points every exercise at that path.

## Supabase migrations

Lobby schema and RPCs live in [`supabase/migrations/`](supabase/migrations/). Apply with the Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor. Use a service-role key only on your machine for admin tasks—never in the client or `.env` bundled with the app.

Manual RPC checks: [`supabase/scripts/verify_lobby_rpc.sql`](supabase/scripts/verify_lobby_rpc.sql).

### Auth (manual verification)

Magic-link sign-in requires Supabase Auth email provider enabled and redirect URLs allowing your dev origin (e.g. `http://localhost:5173`). After `supabase db push` for `20260822140000_auth_claim.sql`:

1. Play a session as guest, finish, sign in via magic link, click **Save this session to my account**.
2. Open **My sessions** — saved session appears with round count.
3. Optional: sign in mid-session, save, then **Log round** still works after claim.

## Architecture decisions

This project is a deliberate from-scratch rebuild of the AMRAP With Friends experience from the interval-timers monorepo. Several features from the reference app are **intentionally excluded**:

- **Tabata timer** support
- **Embed module** and Trainer-Live-specific options
- **WorkoutExplorer** marketing page
- **Hub/handoff** activation tracking across multiple hosted timer apps

The app is fully standalone—not embeddable into another product. Supabase integration uses `@supabase/supabase-js` only (`createClient`); `@supabase/ssr` and cross-subdomain cookie auth are omitted until multi-subdomain auth is actually needed.
