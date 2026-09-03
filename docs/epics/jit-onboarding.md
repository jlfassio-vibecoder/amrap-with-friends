# Epic: JIT Onboarding — Auth → Create → Micro-Dossier

**Branch:** TBD — suggest `feature/jit-onboarding`  
**Status:** Draft — awaiting review  
**Last updated:** 2026-09-03

**Related:** [jit-onboarding-workflow.html](../html-examples/jit-onboarding-workflow.html) (canonical Launch sequence — not a visual spec), [create-account-workflow.md](../audits/create-account-workflow.md) (2026-08-27), [create-account-reentry-2026-09.md](../audits/create-account-reentry-2026-09.md), coach stuck list (`needs_profile`), onboarding architecture assessment (2026-09-03).

---

## Vision

Maximize conversion from “I want to train” to “timer is running.”

Today, signup often lands on a long intake dossier (height, weight, age, sex, rank, username, nickname) **before** the athlete configures a mission. Magic-link-era accounts from late August show the failure mode: auth succeeded, dossier never saved, never returned.

**Target journey (signed-out visitor)** — sequencing from [`jit-onboarding-workflow.html`](../html-examples/jit-onboarding-workflow.html). That file is a **flow mock**, not a visual spec: do not copy its colors, type, layout chrome, or extra protocol options.

1. Land on `/create` (no auth wall). Configure the mission (workout, duration, mission name). Copy: no account required to **configure**.
2. Tap **Launch**. `/create` **stays mounted** under every overlay (loss aversion — the form is still visible / intact).
3. If unsigned → **auth overlay** on top of create (not a navigation to `/intake`). Primary Google, then email/password; magic link buried. Dismiss overlay → back to the same form, no mission created.
4. On auth success, **resume the same Launch chain** (no second Launch tap). If identity is still missing → **identity overlay** on the same create screen.
5. Identity overlay suggests a tactical name (scramble, then enable accept). Athlete can regenerate or type their own. Username is derived silently. Primary: **Accept & Launch** → upsert identity → `create_mission` with the pending form → rally point.
6. Rally point shows the configured mission and the accepted name. Athlete taps **Start** for the clock. They are not dumped into Live.

If already signed in with username + nickname, Launch skips both overlays and creates immediately.

Under ten seconds of friction after Launch for a Google user who accepts the suggestion.

---

## Review of the proposed plan (accepted with amendments)

The phased shape is right. These amendments are required for this codebase and for conversion safety:

| Proposal                                       | Verdict   | Amendment                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default auth away from magic link              | **Keep**  | Magic link already defaults **off** via `VITE_AUTH_MAGIC_LINK_ENABLED` ([`authFeatures.ts`](../../src/lib/auth/authFeatures.ts)). Phase 1 must make password / Google the **visible** primary paths and keep magic link buried (advanced / flag-only), including compact homepage + gated modals.          |
| Post-auth always → `/create`                   | **Amend** | Do **not** yank every success to `/create`. Exceptions: guest-open mission/rally/join paths (stay put), `/campaign/join` + `/squad/join` (finish join), password-recovery return, explicit `?next=` when present. Default for **Create account / homepage / unsigned `/create` gate** success → `/create`. |
| Guest can use `/create` without dossier        | **Keep**  | Remove `RequireIntake` from the `/create` **route**. Defer identity to Launch (Phase 3). Guests may configure; they cannot call `create_mission` until auth + micro-dossier.                                                                                                                               |
| Micro-dossier = username + nickname only       | **Keep**  | Requires a **schema migration**: `height_cm`, `weight_kg`, `birth_year`, `biological_sex`, `perceived_classification` are `NOT NULL` today. Phase 2 must nullable-or-default those columns and teach HUD / overtraining / upsert to tolerate missing metrics.                                              |
| JIT overlay on Launch + auto-ignite            | **Keep**  | Preserve create-form state; after upsert, immediately `create_mission` and land on rally point (Start — not Live). Sequence locked to the HTML workflow mock.                                                                                                                                               |
| Server username/nickname completeness          | **Keep**  | Matches coach stuck semantics and closes client/server gap (EXISTS-only today).                                                                                                                                                                                                                            |
| Randomized tactical callsign, one-click accept | **Keep**  | Pure generator in `src/lib/` with tests; maps to **nickname** (display) and a legal **username** (sanitized, uniqueness retry).                                                                                                                                                                            |

**Vocabulary:** UI says **Mission** / **Launch** / **Your profile** — not session/dossier on athlete-facing chrome. Data layer may still say `athlete_profiles` / intake RPCs.

---

## Current state (baseline)

Phases 1–2 leftovers from the workflow-mock update are implemented on `fix/homepage-scheduled-missions-empty-bar`. Apply [`20260903120000_athlete_profile_identity_optional_metrics.sql`](../../supabase/migrations/20260903120000_athlete_profile_identity_optional_metrics.sql) with `supabase db push` before calling `upsert_athlete_identity` in a remote environment.

| Area                  | Today                                                                                                                                                          | Remaining gap                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/create` gate        | Ungated. Signed-out visitors configure; Launch opens AuthModal (**Save & Launch**). Incomplete identity soft-blocks with `/intake?next=/create`                | Phase 3 identity overlay                           |
| Post-signup routing   | Header / hero / generic signup → `/create` via [`postAuthDestination.ts`](../../src/lib/auth/postAuthDestination.ts). Guest-open and join paths stay put        | —                                                  |
| Auth defaults         | Password + Google primary; magic link buried as **Use an email link instead** when the flag is on                                                              | —                                                  |
| Intake form           | **Your profile** / **HUD metrics**. Username + nickname required; body metrics all-or-nothing (blank → identity upsert)                                        | Phase 3 collects identity at Launch, not here      |
| `athlete_profiles`    | Metrics + rank nullable; `upsert_athlete_identity` exists                                                                                                      | Remote migration until `supabase db push`          |
| `create_mission` gate | `athlete_profiles` **EXISTS** only                                                                                                                             | Phase 4 username/nickname guard                    |
| Launch                | Overlay + resume handler; now-path submit is **Launch**. Identity still a soft-block link                                                                      | Phase 3 Accept & Launch auto-ignite                |
| Stuck cohort          | Coach `needs_profile` — auth users, no profile, often magic-link era                                                                                           | This epic is the product fix                       |

```mermaid
flowchart TD
  subgraph today [Today]
    A1[Auth] --> I1[Full /intake]
    I1 --> C1[/create]
    C1 --> L1[Launch]
  end

  subgraph target [Target — overlays on /create]
    C2["/create configure — stays mounted"] --> L2[Launch]
    L2 --> AuthQ{Signed in?}
    AuthQ -->|no| Auth2[Auth overlay]
    Auth2 -->|dismiss| C2
    Auth2 -->|success resume Launch| IdQ
    AuthQ -->|yes| IdQ{Username and nickname?}
    IdQ -->|missing| M2[Identity overlay]
    M2 -->|Accept and Launch| Create
    IdQ -->|complete| Create[create_mission]
    Create --> RP[Rally point — Start clock]
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

Canonical Launch handler (same function after auth success — **no second Launch click**):

```
/create stays mounted (local mission config)
Launch
    ↓ validate create-form fields
unsigned?
    ↓ yes → Auth overlay on /create (form visible underneath)
         dismiss → stay on /create, form intact, stop
         success → hide overlay, re-enter this handler
    ↓ no
profileNeedsIntake (missing row or blank username/nickname)?
    ↓ yes → Identity overlay on /create
         scramble suggestion → enable Accept
         regenerate or type-your-own (callsign / Your name)
         username derived silently (sanitize + collision retry)
         Accept & Launch → upsert_athlete_identity → hide overlay
    ↓ no (identity already complete)
create_mission(...) with the pending form
    ↓
navigate /mission/:id  (rally point: Start clock — not Live)
```

**Server guardrail (Phase 4):** `create_mission` / campaign / squad RPCs require non-blank username **and** nickname, not mere EXISTS. Standardized error → client opens the identity overlay.

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
   - Overlay on `/create` (create form remains underneath). Auth copy is **Save & Launch** / why they need an account (rally point + leaderboard) — not a trip to `/intake`.
   - Primary: **Continue with Google**; then email + password **Sign in / Sign up**; magic link as **Use an email link instead**.
   - Dismiss (backdrop) cancels auth only; form state kept.
   - On success, **resume the same Launch handler** (Phase 3). If Phase 3 is not shipped yet: incomplete identity soft-blocks on `/create` with a link to `/intake?next=/create` — never auto-dump into the long form. Prefer shipping 1+2+3 as one release train.

### Explicit non-goals (Phase 1)

- Changing `athlete_profiles` schema.
- Removing `/intake` page (still used for voluntary edit / later metrics).
- Allowing `create_mission` without auth.

### Exit criteria

- [x] Magic link not default anywhere in SPA/hero when flag false.
- [x] New password/Google signup from header/hero lands on `/create`, not `/intake`.
- [x] Signed-out user can open `/create` and select a template without a modal.
- [x] Joining a live mission as guest still does not force `/create`.
- [x] Unit tests for `postAuthDestination` + AuthForm default method.
- [x] **P1 interim:** Launch while unsigned opens AuthModal (**Save & Launch**, `guestAllowed={false}`); incomplete identity soft-blocks on `/create` with a link to `/intake?next=/create` (form preserved — no auto intake dump). Full JIT identity overlay is Phase 3.

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

- [x] Migration applied; micro upsert succeeds without metrics. (`20260903120000_athlete_profile_identity_optional_metrics.sql` + `upsert_athlete_identity`). Remote: `supabase db push`.
- [x] Existing full profiles still load and editable. (`parseAthleteProfile` null-tolerant; full `upsert_athlete_profile` unchanged)
- [x] HUD does not error on null metrics. (soft CTA + `quotasFromProfile` fallback)
- [x] Callsign helper tested; no network in pure lib. (`src/lib/onboarding/tacticalCallsign.ts`)
- [x] `/intake` saves identity-only when metrics are blank; any filled metric requires the full set.

---

## Phase 3 — State-preserving JIT identity overlay

**Goal:** Identity is collected at **Launch**, not at route entry. Auth overlay → identity overlay → rally point on the **same Launch chain**. Sequence must match [`jit-onboarding-workflow.html`](../html-examples/jit-onboarding-workflow.html). Do not import that mock’s palette, type, or decorative chrome.

**Depends on:** Phase 2 schema + identity upsert; Phase 1 ungated `/create`.

### Launch intercept ([`CreateMissionPage`](../../src/pages/CreateMissionPage.tsx))

One handler. After auth success, call it again — do not require a second Launch tap.

1. Validate create-form fields (duration, workout, mission name, etc.) as today.
2. If `!isAuthenticated` → open **auth overlay** on `/create`. Create stays in the tree (loss aversion). Backdrop dismiss → hide overlay, stop, form intact.
3. If authenticated but `profileNeedsIntake` → open **identity overlay** on `/create`.
4. If authenticated and identity complete → **ignite**: `create_mission` with pending form state → navigate to `/mission/:id` (rally point).
5. After identity upsert success → hide overlay → **ignite** immediately (same as step 4).
6. Preserve all create-form state across both overlays (React state / ref; do not remount `/create`).

### Auth overlay (unsigned Launch)

Matches the mock’s **order of controls**, not its look:

| Beat | Behavior |
| ---- | -------- |
| Title / why | Save & Launch. Account is so they can hit the rally point and the leaderboard. |
| Primary | Continue with Google |
| Then | Email + password, **Sign in / Sign up** |
| Buried | Use an email link instead |
| Dismiss | Backdrop (and Esc) — no mission created |
| Success | Hide overlay → resume Launch handler (identity overlay or ignite) |

### Identity overlay (signed-in, incomplete profile)

Matches the mock’s **beats**, not its look:

| Beat | Behavior |
| ---- | -------- |
| Why | We need a name for the leaderboard and your squad. Accept or edit. |
| Suggestion | Generated nickname (`Ghost-Actual` / `Viper-2`) via [`suggestAthleteIdentity`](../../src/lib/onboarding/tacticalCallsign.ts). Brief scramble, then reveal. **Accept stays disabled until the suggestion settles.** |
| Regenerate | New suggestion + scramble again. |
| Type your own | Reveal a single **Your name** field (plain English). Hide the generated display while editing. Not a second username field. |
| Username | Derived silently from the accepted name (`Ghost_Actual`). Collision: retry / regenerate. Athlete never fills two identity fields. |
| Primary | **Accept & Launch** — one click. Saving copy while upserting. Then ignite. |
| Button chrome | Plain English on the clickable control. Do not put “callsign” or “dossier” on the button. |

Esc may close the identity overlay without creating a mission (form intact). The mock has no extra cancel button; do not add a long-form `/intake` escape hatch as the primary path.

### After ignite (rally point)

- Mission name, workout, and duration from the create form — not a blank mission.
- Athlete display name is the accepted identity nickname.
- Land on **rally point** (`/mission/:id`): countdown / **Start**, not already in Live.

### Mission name vs athlete name

The mock treats these as two different things. Keep them that way:

| Field | Whose | Where |
| ----- | ----- | ----- |
| Mission name | This workout | Create form (today’s mission nickname / title field) |
| Athlete name | The person | Identity overlay only |

Do not ask for a third name. After identity exists, the create form may still prefill the **mission** nickname from the athlete name if that field is empty — that is a convenience, not a second identity step.

### Other routes (same release or fast follow)

| Route                           | Behavior                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/campaign/new`, host actions   | Same JIT pattern or shared `ensureAthleteIdentity()` helper                                                           |
| `/campaign/join`, `/squad/join` | Incomplete identity → identity overlay then retry join — **not** a dead-end RPC error                                 |
| `/hud`, `/squad` browse         | Prefer soft CTA over hard `/intake` redirect when metrics optional; identity still required where RPCs need names     |

`RequireIntake` either becomes a thin wrapper around `ensureAthleteIdentity` for remaining hard routes or is retired from create/campaign entry in favor of Launch-time checks.

### Analytics

- `micro_dossier_shown`, `micro_dossier_accepted` (`callsign_accepted: true|false`), `micro_dossier_cancelled`
- `mission_created` with `onboarding_path: 'micro_dossier'` when applicable

### Exit criteria

- [ ] Signed-out → configure → Launch → auth overlay → Google/password → identity overlay → Accept & Launch → rally point, **without a second Launch**.
- [ ] Auth overlay dismiss leaves `/create` form intact and does not create a mission.
- [ ] Signed-in incomplete profile → Launch → identity overlay → rally point (no `/intake` navigation).
- [ ] Signed-in complete profile → Launch → rally point with no overlays.
- [ ] Rally point shows the configured mission and accepted name; clock starts only on Start.
- [ ] Component + handler tests (mock upsert + `create_mission`).

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

3. Client map: that code opens the identity overlay (or `ensureAthleteIdentity`) and retries the original action once.

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
| **T1 (recommended)** | 1 + 2 + 3                                         | One conversion story: browse → Launch → auth overlay → identity overlay → rally point                                   |
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

## Open questions

1. **Default perceived_classification / sex when metrics omitted** — **Resolved (Phase 2):** NULL + HUD CTA.
2. **Username visible in identity overlay?** — **Resolved (workflow mock):** derive silently from the accepted name. One editable field if they type their own (**Your name**). Collision retry is invisible.
3. **Campaign/squad in T1 or fast follow?** — create-mission path is P0; join paths are P0 for the dead-end error gap.
4. **Retire `RequireIntake` on `/hud`?** — signed-in without identity could see HUD empty state + CTA instead of forced intake; decide in Phase 3.

---

## File touch map (expected)

| Area             | Files                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Auth destination | `src/lib/auth/postAuthDestination.ts`, `AuthHeaderActions`, `HeroBelowLogo`, `AuthForm` / `AuthModal`, `RequireIntake` usage in `App.tsx` |
| Create Launch    | `CreateMissionPage.tsx`, auth overlay on Launch, identity overlay (suggestion + Accept & Launch), callsign lib + tests                    |
| Profile API      | `athleteProfile.ts`, optional `upsert_athlete_identity`                                                                                   |
| Schema / RPCs    | New migration(s); `upsert_*`, `create_mission`, campaign/squad gates                                                                      |
| HUD resilience   | `hud/*` consumers, Intake page split (identity vs metrics)                                                                                |
| Analytics        | `track` call sites on modal + create                                                                                                      |

---

## Phase checklist (roll-up)

- [x] **P1** Auth primary = password/Google; post-auth policy; `/create` ungated for browse; Launch **Save & Launch** overlay
- [x] **P2** Nullable metrics + identity upsert; HUD tolerates nulls; callsign generator; optional `/intake` metrics
- [ ] **P3** Launch → auth overlay if needed → identity overlay if needed → auto `create_mission` → rally point
- [ ] **P4** RPC username/nickname guard + client retry via modal
