# Epic: JIT Onboarding — Auth → Create → Micro-Dossier

**Branch:** TBD — suggest `feature/jit-onboarding`  
**Status:** Draft — awaiting review  
**Last updated:** 2026-09-03

**Related:** [create-account-workflow.md](../audits/create-account-workflow.md) (2026-08-27), [create-account-reentry-2026-09.md](../audits/create-account-reentry-2026-09.md), coach stuck list (`needs_profile`), onboarding architecture assessment (2026-09-03).

---

## Vision

Maximize conversion from “I want to train” to “timer is running.”

Today, signup often lands on a long intake dossier (height, weight, age, sex, rank, username, nickname) **before** the athlete configures a mission. Magic-link-era accounts from late August show the failure mode: auth succeeded, dossier never saved, never returned.

**Target journey (signed-out visitor):**

1. Land on `/create` (no auth wall).
2. Pick a workout and set duration / nickname / options.
3. Tap **Launch**.
4. If needed: fast auth (password or Google — not magic link).
5. If needed: one-screen **Micro-Dossier** with a one-click tactical callsign.
6. Mission creates and they enter the rally point — **no second Launch click**.

Under ten seconds of friction after “Launch” for a Google user who accepts the suggested callsign.

---

## Review of the proposed plan (accepted with amendments)

The phased shape is right. These amendments are required for this codebase and for conversion safety:

| Proposal                                       | Verdict   | Amendment                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default auth away from magic link              | **Keep**  | Magic link already defaults **off** via `VITE_AUTH_MAGIC_LINK_ENABLED` ([`authFeatures.ts`](../../src/lib/auth/authFeatures.ts)). Phase 1 must make password / Google the **visible** primary paths and keep magic link buried (advanced / flag-only), including compact homepage + gated modals.          |
| Post-auth always → `/create`                   | **Amend** | Do **not** yank every success to `/create`. Exceptions: guest-open mission/rally/join paths (stay put), `/campaign/join` + `/squad/join` (finish join), password-recovery return, explicit `?next=` when present. Default for **Create account / homepage / unsigned `/create` gate** success → `/create`. |
| Guest can use `/create` without dossier        | **Keep**  | Remove `RequireIntake` from the `/create` **route**. Defer identity to Launch (Phase 3). Guests may configure; they cannot call `create_mission` until auth + micro-dossier.                                                                                                                               |
| Micro-dossier = username + nickname only       | **Keep**  | Requires a **schema migration**: `height_cm`, `weight_kg`, `birth_year`, `biological_sex`, `perceived_classification` are `NOT NULL` today. Phase 2 must nullable-or-default those columns and teach HUD / overtraining / upsert to tolerate missing metrics.                                              |
| JIT modal on Launch + auto-ignite              | **Keep**  | Preserve create-form state; after upsert, immediately `create_mission` and navigate.                                                                                                                                                                                                                       |
| Server username/nickname completeness          | **Keep**  | Matches coach stuck semantics and closes client/server gap (EXISTS-only today).                                                                                                                                                                                                                            |
| Randomized tactical callsign, one-click accept | **Keep**  | Pure generator in `src/lib/` with tests; maps to **nickname** (display) and a legal **username** (sanitized, uniqueness retry).                                                                                                                                                                            |

**Vocabulary:** UI says **Mission** / **Launch** / **Your profile** — not session/dossier on athlete-facing chrome. Data layer may still say `athlete_profiles` / intake RPCs.

---

## Current state (baseline)

| Area                  | Today                                                                                                                                                   | Gap                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/create` gate        | [`RequireIntake`](../../src/components/RequireIntake.tsx) `guestMode="sign-in"` — soft auth wall, then hard redirect to `/intake` if profile incomplete | Blocks browsing; forces full dossier before create UI |
| Post-signup routing   | Header Create account → `/intake?next=…` (Sep 2); hero → `/intake?next=/create`                                                                         | Sends new users into long form before value           |
| Auth defaults         | Magic link flag off; Google flagged; password primary when flags off                                                                                    | Must stay definitive in UI hierarchy                  |
| Intake form           | Full dossier on [`IntakePage`](../../src/pages/IntakePage.tsx)                                                                                          | Too much before first mission                         |
| `athlete_profiles`    | Metrics + sex + rank **NOT NULL**; username/nickname required on upsert                                                                                 | Cannot insert micro row without migration             |
| `create_mission` gate | `athlete_profiles` **EXISTS** only                                                                                                                      | Blank names could pass server; client is stricter     |
| Launch                | Single button after form fill; nickname field on create page                                                                                            | No JIT identity modal; no auto-retry after intake     |
| Stuck cohort          | Coach `needs_profile` — auth users, no profile, often magic-link era                                                                                    | This epic is the product fix                          |

```mermaid
flowchart LR
  subgraph today [Today]
    A1[Auth] --> I1[Full /intake]
    I1 --> C1[/create]
    C1 --> L1[Launch]
  end

  subgraph target [Target]
    A2[/create browse] --> L2[Launch]
    L2 --> Auth2[Auth if needed]
    Auth2 --> M2[Micro-Dossier if needed]
    M2 --> RP[Rally point]
  end
```

---

## Success metrics

| Metric                                                          | How to read it                                 |
| --------------------------------------------------------------- | ---------------------------------------------- |
| Auth → first `mission_created` (same day)                       | Primary conversion                             |
| Coach `needs_profile` count (new signups / week)                | Should trend toward zero for post-ship cohorts |
| `intake_submitted` with `source: micro_dossier` vs full profile | Micro path adoption                            |
| Time from Launch click → mission route (p50)                    | Friction budget                                |
| Magic-link share of new `auth.users`                            | Should stay near zero while flag off           |

Instrument: reuse `track()` — add props `onboarding_path: 'micro_dossier' | 'full_profile'`, `callsign_accepted: boolean`, and a stable RPC error code (Phase 4).

---

## Master architecture

```
/create (no RequireIntake)
    ↓ configure mission (local state)
Launch
    ↓
unsigned? → AuthModal (password / Google primary)
    ↓ session
profile missing or blank username/nickname?
    ↓ yes
MicroDossierModal (suggested callsign → username + nickname)
    ↓ upsert_athlete_profile (micro)  OR  upsert_athlete_identity (new thin RPC)
    ↓
create_mission(...)   -- same click chain
    ↓
navigate /mission/:id
```

**Server guardrail (Phase 4):** `create_mission` / campaign / squad RPCs require non-blank username **and** nickname, not mere EXISTS. Standardized error → client opens Micro-Dossier.

---

## Phase 1 — Auth routing & magic-link burial

**Goal:** New sessions land ready to train on `/create`, without passwordless lockout traps. Guests can **browse** create without auth.

**Depends on:** nothing  
**Risk:** Over-broad “always `/create`” breaks join / in-mission auth — handle exceptions explicitly.

### Deliverables

1. **Auth UI hierarchy**
   - Password + Google (when `isGoogleAuthEnabled()`) are the primary controls on [`AuthForm`](../../src/components/AuthForm.tsx) / compact hero.
   - Magic link remains behind `isMagicLinkAuthEnabled()` only; when on, secondary “Email link” disclosure — never the default tab.
   - Confirm homepage compact form, header Create account, and `/create` Launch auth all share this hierarchy.

2. **Post-auth destination policy** (single helper, e.g. `src/lib/auth/postAuthDestination.ts`)

   | Context                                                          | After session established             |
   | ---------------------------------------------------------------- | ------------------------------------- |
   | Explicit safe `next` query / intake return                       | Honor `safeNext`                      |
   | Guest-open path (`isGuestOpenPath`)                              | Stay on current URL                   |
   | Campaign / squad join                                            | Stay / complete join                  |
   | Password recovery                                                | Existing recovery → profile or `next` |
   | Create account, homepage, unsigned create, generic header signup | **`/create`**                         |

   **Do not** send these successes to `/intake`.

3. **`/create` route ungated**
   - Remove `RequireIntake` wrapper from `/create` in [`App.tsx`](../../src/App.tsx).
   - Keep Featured WOD / picker usable signed-out.
   - Soft copy optional: “Launch will ask you to sign in.”

4. **Launch without session**
   - Opens AuthModal (`sign-up` or `sign-in` as appropriate); on success, continue Phase 3 chain (or temporary: if Phase 3 not shipped, open Micro-Dossier stub / full intake only as fallback — prefer shipping 1+2+3 as one release train).

### Explicit non-goals (Phase 1)

- Changing `athlete_profiles` schema.
- Removing `/intake` page (still used for voluntary edit / later metrics).
- Allowing `create_mission` without auth.

### Exit criteria

- [ ] Magic link not default anywhere in SPA/hero when flag false.
- [ ] New password/Google signup from header/hero lands on `/create`, not `/intake`.
- [ ] Signed-out user can open `/create` and select a template without a modal.
- [ ] Joining a live mission as guest still does not force `/create`.
- [ ] Unit tests for `postAuthDestination` + AuthForm default method.
- [ ] **P1 interim:** Open rally point while unsigned opens AuthModal; incomplete identity soft-blocks on `/create` with a link to `/intake?next=/create` (form preserved — no auto intake dump). Full JIT Micro-Dossier is Phase 3.

---

## Phase 2 — Micro-dossier data model & optional metrics

**Goal:** A valid `athlete_profiles` row can exist with **only** username + nickname. Body metrics and rank move to optional HUD settings.

**Depends on:** Phase 1 for product sequencing; schema can land in parallel.

### Schema (required)

Migration (new dated file under `supabase/migrations/`):

1. Alter `athlete_profiles` so `height_cm`, `weight_kg`, `birth_year`, `biological_sex`, `perceived_classification` are **nullable** (or drop NOT NULL and stop requiring them on insert).
2. Keep username format + nickname length checks; unique `lower(username)`.
3. Update `upsert_athlete_profile` **or** add `upsert_athlete_identity(p_username, p_nickname)` SECURITY DEFINER that:
   - Requires auth.
   - Upserts **only** identity fields.
   - Leaves existing metrics untouched when omitted.
   - Does **not** require height/weight/sex/rank.
4. `get_athlete_profile` returns nulls for missing metrics; client parsers already tolerate some nulls — harden [`parseAthleteProfile`](../../src/lib/api/athleteProfile.ts) and HUD consumers.

### Product

| Surface                                   | Behavior                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Micro-Dossier (Phase 3)                   | Username + nickname only                                                                                     |
| `/intake` or “Edit profile / HUD metrics” | Optional metrics + rank; plain-English title (**Your profile** / **HUD metrics**) — not “dossier” on buttons |
| HUD / overtraining / classification       | If metrics missing: show empty/CTA “Add body metrics for load telemetry” — do not crash or block missions    |
| Classification history                    | Unchanged when rank eventually set                                                                           |

### Callsign generator (library, Phase 2 or 3)

Pure module e.g. [`src/lib/onboarding/tacticalCallsign.ts`](../../src/lib/onboarding/tacticalCallsign.ts):

- Output display nickname: `Ghost-Actual`, `Viper-2`, `Hull-Breach`, etc. (curated word lists × number/role suffix).
- Derive username: sanitize to `^[A-Za-z0-9_]{3,30}$` (e.g. `Ghost_Actual`, `Viper_2`).
- `suggestAthleteIdentity(): { username, nickname }` with collision retry helper used by modal (client tries upsert; on “username taken”, regenerate).
- Unit tests for format, uniqueness of samples, sanitization.

### Exit criteria

- [x] Migration applied; micro upsert succeeds without metrics. (`20260903120000_athlete_profile_identity_optional_metrics.sql` + `upsert_athlete_identity`)
- [x] Existing full profiles still load and editable. (`parseAthleteProfile` null-tolerant; full `upsert_athlete_profile` unchanged)
- [x] HUD does not error on null metrics. (soft CTA + `quotasFromProfile` fallback)
- [x] Callsign helper tested; no network in pure lib. (`src/lib/onboarding/tacticalCallsign.ts`)

---

## Phase 3 — State-preserving JIT Micro-Dossier modal

**Goal:** Identity is collected at **Launch**, not at route entry. One click through auth + callsign → mission live.

**Depends on:** Phase 2 schema + identity upsert; Phase 1 ungated `/create`.

### Launch intercept ([`CreateMissionPage`](../../src/pages/CreateMissionPage.tsx))

On Launch / create submit:

1. Validate create-form fields (duration, workout, etc.) as today.
2. If `!isAuthenticated` → open AuthModal; on success, **resume same Launch handler** (do not require second click).
3. If authenticated but `profileNeedsIntake` (missing row or blank username/nickname) → open **MicroDossierModal**.
4. On micro save success → call `create_mission` with pending form state → navigate to rally point.
5. Preserve all create-form state across auth + modal (React state / ref; do not remount page).

### MicroDossierModal UX

- Overlay on `/create` (focus trap, Esc cancels without wiping form).
- Shows suggested **callsign** (nickname) prominently; username shown as secondary “handle” or derived silently.
- Primary CTA: **Use callsign** (accept suggestion) — one click.
- Secondary: edit nickname / username before save.
- Copy in plain English: why we need a name (leaderboard / squad), not military chrome on the button.
- On success: close modal and **immediately** ignite create (Phase 3 goal).
- On cancel: stay on `/create` with form intact; no mission created.

### Interaction with create-page nickname field

Today the page has a mission `nickname` field prefilled from profile. After micro-dossier:

- Prefill mission nickname from profile nickname / accepted callsign.
- Avoid asking for three names — micro-dossier nickname **is** the workout callsign default.

### Other routes (same release or fast follow)

| Route                           | Behavior                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/campaign/new`, host actions   | Same JIT pattern or shared `ensureAthleteIdentity()` helper                                                                     |
| `/campaign/join`, `/squad/join` | On Intake-required / incomplete identity → Micro-Dossier (or thin ensure helper) then retry join — **not** a dead-end RPC error |
| `/hud`, `/squad` browse         | Prefer soft CTA over hard `/intake` redirect when metrics optional; identity still required where RPCs need names               |

`RequireIntake` either becomes a thin wrapper around `ensureAthleteIdentity` for remaining hard routes or is retired from create/campaign entry in favor of Launch-time checks.

### Analytics

- `micro_dossier_shown`, `micro_dossier_accepted` (`callsign_accepted: true|false`), `micro_dossier_cancelled`
- `mission_created` with `onboarding_path: 'micro_dossier'` when applicable

### Exit criteria

- [ ] Signed-out → configure → Launch → auth → accept callsign → mission route without second Launch.
- [ ] Signed-in incomplete profile → Launch → modal → mission (no `/intake` navigation).
- [ ] Cancel modal leaves form state.
- [ ] Component + handler tests (mock upsert + create_mission).

---

## Phase 4 — Server RPC alignment (guardrail)

**Goal:** Server and client agree: a usable athlete has non-blank username **and** nickname. Bypass UI → clear, modal-triggerable error.

**Depends on:** Phase 2 (identity can exist); ideally with Phase 3 client handling.

### Deliverables

1. Shared SQL check (inline or small helper function), used by:
   - `create_mission`
   - `create_rally_point_session` / next-mission host RPCs as applicable
   - `create_campaign`, `join_campaign`
   - Squad create / invite / accept RPCs
   - Any other `Intake required` EXISTS gates

   Replace EXISTS-only with: row present **and** `nullif(btrim(username),'')` / nickname non-null.

2. **Stable error** — e.g. raise `Intake required` remains OK if client already maps it, **or** prefer a dedicated message / `ERRCODE` / JSON `{ ok:false, code:'athlete_identity_required' }` consistent with existing RPC styles. Document the one string/code the SPA keys on.

3. Client map: that code opens Micro-Dossier (or `ensureAthleteIdentity`) and retries the original action once.

4. Coach stuck list stays valid: `needs_profile` / `intake_incomplete` still describe the same population.

### Exit criteria

- [ ] Migration covers listed RPCs.
- [ ] API client maps the error to identity modal, not a generic toast only.
- [ ] Parser/unit tests for error mapping.
- [ ] Manual: delete username in SQL (dev) → Launch shows modal instead of opaque failure.

---

## Suggested ship train

| Train                | Phases                                            | Notes                                                                                                                   |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **T0**               | 1 (auth routing + ungated `/create` browse) alone | Only if Launch still blocks safely; avoid shipping ungated create with Launch → full `/intake` (regression). Prefer T1. |
| **T1 (recommended)** | 1 + 2 + 3                                         | One conversion story: browse → Launch → auth → callsign → mission                                                       |
| **T2**               | 4                                                 | Guardrail; can overlap end of T1                                                                                        |

Do **not** ship Phase 1 guest `/create` without Phase 3 Launch identity, or conversion will look like “Launch dumps me into a long form.”

---

## Out of scope

- Deleting or emailing the five historical stuck users (ops / coach follow-up).
- Redesigning HUD telemetry math.
- Making body metrics required again for create.
- Changing guest **join** mission play (nickname-only guests on `/join` stay).
- Forcing Google on in production (flag + provider config remain ops).

---

## Open questions (resolve before Phase 2 build)

1. **Default perceived_classification / sex when metrics omitted** — leave NULL and teach HUD, or server default `civilian` / unknown? Prefer **NULL + HUD CTA** for honesty.
2. **Username visible in Micro-Dossier?** — show editable handle vs derive silently from callsign (collision retry invisible).
3. **Campaign/squad in T1 or fast follow?** — create-mission path is P0; join paths are P0 for the dead-end error gap.
4. **Retire `RequireIntake` on `/hud`?** — signed-in without identity could see HUD empty state + CTA instead of forced intake; decide in Phase 3.

---

## File touch map (expected)

| Area             | Files                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Auth destination | `src/lib/auth/postAuthDestination.ts`, `AuthHeaderActions`, `HeroBelowLogo`, `AuthForm` / `AuthModal`, `RequireIntake` usage in `App.tsx` |
| Create Launch    | `CreateMissionPage.tsx`, new `MicroDossierModal.tsx`, callsign lib + tests                                                                |
| Profile API      | `athleteProfile.ts`, optional `upsert_athlete_identity`                                                                                   |
| Schema / RPCs    | New migration(s); `upsert_*`, `create_mission`, campaign/squad gates                                                                      |
| HUD resilience   | `hud/*` consumers, Intake page split (identity vs metrics)                                                                                |
| Analytics        | `track` call sites on modal + create                                                                                                      |

---

## Phase checklist (roll-up)

- [ ] **P1** Auth primary = password/Google; post-auth policy; `/create` ungated for browse
- [ ] **P2** Nullable metrics + identity upsert; HUD tolerates nulls; callsign generator
- [ ] **P3** Launch intercept → Micro-Dossier → auto `create_mission`
- [ ] **P4** RPC username/nickname guard + client retry via modal
