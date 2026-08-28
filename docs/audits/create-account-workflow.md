# Create-account workflow — architecture assessment and gap analysis

**Date:** 2026-08-27  
**Scope:** How a new user obtains an `auth.users` row and a usable session, from first click through email confirmation and first authenticated action.  
**Out of scope:** Guest play, session claim, coach allowlisting, password-reset (already marked follow-up in README).  
**Sources:** `AuthModal`, `AmrapAuthProvider`, `RequireIntake`, `AuthHeaderActions`, `supabase/config.toml`, README Auth notes. Live production checks on 2026-08-27: GoTrue `/auth/v1/settings`, `auth.users` aggregates, Vercel project domains + deployment protection, Management API `GET /v1/projects/{ref}/config/auth` (via PAT with `auth_config_read`).

---

## 1. What “create account” actually is

There is no dedicated `/signup` route. Account creation is a mode inside `AuthModal`, which is titled **Sign in** everywhere it is mounted (`AuthHeaderActions`, `RequireIntake` on `/create`, `RequireCoach`, Ghost picker, session save).

A successful account, in product terms, is three stacked layers. The UI only implements the first:

| Layer | Where it lives | Required to “have an account”? |
| --- | --- | --- |
| Auth user + session | Supabase Auth (`signUp` / magic-link OTP) | Yes — this is create-account |
| Email confirmed | Hosted Auth “Confirm email” (often ON; local `enable_confirmations = false`) | Yes on hosted if confirmations are on |
| Intake dossier | `athlete_profiles` via `/intake` | Yes to **create a session**; not required to exist as a user |

New users hitting **Create session** (the home primary CTA) must complete all three before they see the create-session form. Users who only tap header **Sign in** can create an auth user and never be told that intake exists until they try `/create` or `/hud`.

```mermaid
flowchart TD
  entry[Header Sign in or Create session gate]
  modal[AuthModal titled Sign in]
  magic[Magic link tab default]
  password[Password tab]
  create[Create account sub-mode]
  signIn[Sign in sub-mode]
  otp[signInWithOtp shouldCreateUser default true]
  signup[auth.signUp no emailRedirectTo]
  session{Session issued?}
  confirm[Check email then sign in]
  fake[User plus empty identities treated as confirm]
  intake[/intake dossier]
  createPage[/create]

  entry --> modal
  modal --> magic
  modal --> password
  password --> create
  password --> signIn
  magic --> otp
  create --> signup
  otp --> session
  signup --> session
  session -->|yes| closeModal[Modal auto-closes]
  session -->|no plus user| confirm
  session -->|no plus fake user| fake
  closeModal --> intake
  confirm --> signIn
  intake --> createPage
```

---

## 2. Current architecture

### 2.1 Client

- **Provider:** `AmrapAuthProvider` wraps the app, listens to `onAuthStateChange`, treats `user !== null` as authenticated.
- **Client:** `createClient` with `persistSession`, `autoRefreshToken`, `detectSessionInUrl: true` (PKCE / hash tokens from confirmation links can land on any SPA path; `vercel.json` rewrites `/(.*)` → `index.html`, so that part is sound).
- **Create-account API:** `signUpWithPassword` → `supabase.auth.signUp({ email, password })` with **no** `emailRedirectTo`. Contrast: magic link passes `emailRedirectTo: origin + pathname`.
- **Password policy:** client-side min length 6, documented as needing to match Dashboard. No complexity rules. No confirm-password field.
- **Success handling:**
  - `data.session` → success, modal closes because `isAuthenticated`.
  - `data.user` and no session → `needsEmailConfirmation: true` → “Check your email to confirm your account, then sign in.”
  - Errors → raw `error.message` shown as `Error: …`.

### 2.2 Auth UI

- Default method: **Magic link**.
- Password is a second tab; **Create account** is a third control inside that tab (Sign in | Create account).
- After password sign-up success (including the confirm-email state), email/password fields and submit are **disabled** (`status === 'success'`). The user cannot switch to Sign in without closing and reopening the modal — and closing drops the success copy.
- Magic-link success locks the form (`isSuccessLocked`) but password confirm-email success also locks without a “Resend confirmation” or “I already confirmed — sign in” action.
- No AuthModal unit tests. Provider tests cover signUp session-null and a **server-returned** `"User already registered"` error only.

### 2.3 Platform (local config vs hosted)

Local `supabase/config.toml`:

- `site_url = "http://127.0.0.1:3000"` and `additional_redirect_urls` only that origin. The Vite app is **5173**. Confirmation / magic-link redirects generated from local config would miss the real origin.
- `enable_confirmations = false` locally; README warns hosted Confirm email is often **ON**.
- `enable_signup = true`.
- SMTP block is commented out. Hosted projects without custom SMTP use Supabase’s default mailer (rate-limited, easy to land in spam).
- `[auth.rate_limit] email_sent = 2` per hour when local SMTP is enabled — a single retry loop burns the budget.

Hosted settings (Site URL, redirect allow-list, SMTP, leaked-password protection, password min) are **not encoded in the repo**. Confirm email **is** readable from public GoTrue settings: production currently has **`mailer_autoconfirm = true`** (Confirm email **OFF**), matching local `enable_confirmations = false`. Drift remains a risk for everything the Dashboard API would not return.

---

## 3. Intended journeys vs what the code does

| User intent | What they click | What the system does | Outcome risk |
| --- | --- | --- | --- |
| “Make an account” | Header **Sign in** | Opens Sign-in modal on Magic link | Many never find Create account |
| “Make an account” | Magic link | `signInWithOtp` **creates** a user (SDK default `shouldCreateUser: true`) with **no password** | Later password Sign in / Create account fails or looks like a duplicate |
| “Make an account” | Password → Create account | `signUp` | Works if confirmations off and email is new |
| Confirm email (hosted ON) | Same | Session null; told to check email | Email may never arrive; link may use wrong Site URL; no `emailRedirectTo` on signUp |
| Retry after a first attempt | Create account again | Hosted + confirmations ON often returns **200 + user + empty `identities`**, no error | UI says “check your email” for a duplicate; no mail; user believes signup is broken |
| First action: Create session | Home CTA | Must sign in **and** complete intake | Feels like account creation failed when they are only missing the dossier |
| After confirm link | Opens production/preview URL | `detectSessionInUrl` should set session | Breaks if URL not on Auth redirect allow-list |

---

## 4. Gap analysis

Severity: **P0** blocks new users from a session; **P1** high confusion / silent failure; **P2** polish and observability.

### P0 — Duplicate signup looks like success (fake user)

When Confirm email is enabled, GoTrue does not return `"User already registered"` for an existing email. It returns a user object with **no identities** and no session, to avoid email enumeration.

`signUpWithPassword` treats any `data.user` without `data.session` as `needsEmailConfirmation: true`.

**Impact:** Second attempt (typo retry, magic-link user later setting a password, refresh) shows “Check your email…” and never creates or recovers the account. This is the most likely “new users can’t create an account” report if confirmations are on.

**Fix:** If `user.identities?.length === 0` (and/or `identities` missing), show “An account with this email already exists. Sign in, or use a magic link.” Do not claim confirmation was sent. Cover this in provider tests; today’s test only mocks an explicit error.

### P0 — Confirmation email redirect is unconfigured on sign-up

Magic link sets `emailRedirectTo` to the current origin+path. Password `signUp` does not.

Confirmation links therefore use Dashboard **Site URL**. If that is still a localhost, old preview domain, or missing Vercel production/preview URLs, the user confirms and lands on a dead origin or a redirect-reject page — which they report as “I created an account and nothing happened.”

**Fix:** Pass the same `emailRedirectTo` (or a dedicated `/auth/callback` that then routes to `next`) on `signUp`. Keep production + preview + `localhost:5173` on the Auth redirect allow-list. Align `site_url` with production.

### P0 — Confirm-email + default mailer

Local confirmations are off; hosted is often on. Without custom SMTP, signup emails are delayed, dropped, or spam-folder. There is **no resend confirmation** in the modal.

**Fix:** Confirm Dashboard: custom SMTP, Confirm email on/off as a product decision, and a Resend control. If the product can tolerate it, turn Confirm email **off** until mail is proven — local already runs that way.

### P1 — Two unlabeled create-account paths

Magic link is the default tab and creates users. Create account is hidden behind Password. A user who “signed up” via magic link has no password; Create account on the same email then hits P0 or a confusing Auth error.

**Fix:** Label Magic link as “Email me a sign-in link (creates an account if you’re new).” Or set `shouldCreateUser: false` on OTP and force password Create account for new users. Do not leave both as silent create.

### P1 — Discoverability

Every entry point says **Sign in**. Home does not offer Create account. Create-account is two clicks inside the modal. Title never changes to “Create account.”

**Fix:** Header **Sign in / Join**; default Password tab to Create account when opened from `/create`; change dialog title with mode.

### P1 — Success state traps the user

After confirm-email success, inputs stay disabled. Copy says “then sign in” but Sign in is not an enabled action. Closing the modal loses the message. Signing in before confirm yields GoTrue’s raw **Email not confirmed**.

**Fix:** Keep email filled; enable Sign in; add Resend; map `email_not_confirmed` to the same check-inbox copy.

### P1 — Account ≠ ready to create a session

`RequireIntake` sends a brand-new session user to `/intake` with no post-signup handoff from the header Sign-in path. Users who thought “Create account” was the whole job bounce.

**Fix:** After first session, if dossier missing, navigate to `/intake?next=/create` (or `/hud`) instead of only closing the modal.

### P1 — Config drift is operational, not coded

README already flags hosted vs local. Nothing in CI or the client reads Confirm-email / min password / Site URL. A Dashboard toggle can break production signup without a deploy.

**Fix:** Document the production Auth checklist as a release gate. Optionally a tiny health RPC or admin note in Coach. Keep `AUTH_MIN_PASSWORD_LENGTH` in lockstep with Dashboard.

### P2 — Error mapping and enumeration

Raw messages (`User already registered`, `Invalid login credentials`, `Email not confirmed`, rate-limit text) leak Auth internals and are inconsistent with the fake-user path (which hides existence).

**Fix:** Map known GoTrue codes to a small set of athlete-facing strings. Accept that confirmations-on already prevents reliable enumeration.

### P2 — No funnel telemetry

`track()` is used for RPCs, not for `auth_sign_up_attempted` / `succeeded` / `needs_confirmation` / `failed`. “New users have issues” cannot be quantified from product analytics.

**Fix:** Fire those events from `signUpWithPassword` / AuthModal (never log emails).

### P2 — Tests and password UX

No AuthModal tests. No test for empty-identities. No confirm-password field. No forgot-password (known gap). Magic-link form has no “this creates an account” copy.

### P2 — Local `site_url` / port mismatch

`127.0.0.1:3000` vs Vite `5173` will break anyone testing confirmation against local Auth. Hosted is what production users hit, but local confirmation QA is currently lying.

---

## 5. Likely user-visible failure modes (ranked)

**Current production (Confirm email OFF; Site URL/allow-list misconfigured, 2026-08-28):**

1. **Magic link from www or .vercel.app** — redirect not on allow-list; Site URL is localhost.
2. Default mailer + **2 emails/hour** rate limit — magic-link mail never arrives or is throttled.
3. Preview / unique Vercel URL behind SSO — never reach AuthModal.
4. Create account buried (Sign in + Magic link default).
5. Magic-link user later fails password create/sign-in (`User already registered`).
6. Session succeeds but `/create` demands intake.

**If Confirm email is turned ON later:** empty-identities fake success, missing `emailRedirectTo` on `signUp`, and default mailer drop to the top of this list.

---

## 6. Recommended work (order)

1. ~~**Fix Dashboard URLs**~~ — applied 2026-08-28 via Management API PATCH.
2. **Custom SMTP** + raise `rate_limit_email_sent` — [Auth SMTP](https://supabase.com/dashboard/project/djtwrbwagytdjlpfcipj/auth/smtp). Keep Confirm email **off** until mail is proven.
3. **Pass `emailRedirectTo`** on `signUp` anyway (latent when confirmations are toggled on).
4. **Untangle magic link vs password create** (copy and/or `shouldCreateUser: false`).
5. **Detect fake duplicate users** before anyone enables Confirm email. Map `"User already registered"` now.
6. **Un-lock the success state**; change modal title; optional post-signup `/intake` redirect.
7. Add AuthModal tests and signup funnel events.

---

## 7. Production debug — four Dashboard checks (2026-08-27)

Project: `djtwrbwagytdjlpfcipj` (`amrap-with-friends`, `us-west-2`). Production app hosts from Vercel: `https://www.amrapwithfriends.com` (apex `amrapwithfriends.com` 308s there), plus `https://amrap-with-friends.vercel.app`. GitHub homepage is the `.vercel.app` alias.

### 7.1 Confirm email — **OFF** (verified)

Public GoTrue `GET /auth/v1/settings`:

| Flag | Production value | Meaning |
| --- | --- | --- |
| `mailer_autoconfirm` | `true` | Confirm email is **disabled**. Password `signUp` should issue a **session immediately**. |
| `disable_signup` | `false` | New signups allowed. |
| `external.email` | `true` | Email provider on; no other OAuth providers enabled. |

This matches local `enable_confirmations = false` and the hosted user table: **12 / 12** `auth.users` rows are confirmed and have `last_sign_in_at` (all created in the last 7 days; 0 unconfirmed; 0 never signed in).

**Impact on the P0 “fake duplicate / check your email” path:** that GoTrue empty-`identities` behavior is specific to Confirm email **ON**. It is **not** the current production confirmation mode. Duplicate password signup should surface `"User already registered"` (already handled as a raw error in the provider). Keep the empty-identities fix anyway — one Dashboard toggle would re-open that hole.

Password create-account is therefore **not** blocked by missing confirmation mail right now. Magic link (the **default** tab) still depends on mail delivery.

### 7.2 SMTP — **default mailer only** (verified)

Management API (2026-08-28):

| Field | Production value |
| --- | --- |
| `smtp_host` | `null` |
| `custom_smtp` | **false** |
| `smtp_admin_email` / `smtp_sender_name` | `null` |
| `rate_limit_email_sent` | **2 / hour** |
| `hook_send_email_enabled` | `false` |

Magic link (default AuthModal tab) uses Supabase’s built-in mailer — rate-limited, often spam-foldered. With only **2 emails/hour** project-wide, a few signup attempts plus retries can exhaust the budget quickly.

Password signup does not need mail while Confirm email is off. Magic link **does**.

**Fix:** Configure custom SMTP in [Auth SMTP](https://supabase.com/dashboard/project/djtwrbwagytdjlpfcipj/auth/smtp), then raise `rate_limit_email_sent` to a sane value (Dashboard → Rate Limits). Inbox delivery for Gmail/corporate domains was not probed (would send production mail).

### 7.3 Site URL — **fixed** (2026-08-28)

| Field | Was | Now |
| --- | --- | --- |
| `site_url` | `http://localhost:3000` | `https://www.amrapwithfriends.com` |

Applied via `PATCH /v1/projects/djtwrbwagytdjlpfcipj/config/auth`.

### 7.4 Redirect allow-list — **fixed** (2026-08-28)

| Field | Was | Now |
| --- | --- | --- |
| `uri_allow_list` | `http://localhost:5173` | Four comma-separated entries (Management API format; newlines are stripped) |

Current allow-list:

```
https://www.amrapwithfriends.com/**
https://amrap-with-friends.vercel.app/**
http://localhost:5173/**
http://127.0.0.1:5173/**
```

Applied via Management API PATCH. Magic link `emailRedirectTo` from production should now be accepted.

**Note:** first PATCH attempt used newline-separated URLs; the API concatenated them into one invalid string. Re-applied with comma separation — the format GoTrue expects.

Hosts that exist on Vercel (for reference):

| Host | HTTP (unauthenticated curl) | Must be on Auth allow-list if users sign in there? |
| --- | --- | --- |
| `https://www.amrapwithfriends.com` | 200, no Vercel SSO | **Yes — canonical production** |
| `https://amrapwithfriends.com` | 308 → www | Optional (redirects before the SPA runs) |
| `https://amrap-with-friends.vercel.app` | 200, no Vercel SSO | **Yes** if this GitHub homepage is a real entry point |
| `https://amrap-with-friends-office-4354s-projects.vercel.app` | (team alias) | Only if used |
| `https://amrap-with-friends-git-main-office-4354s-projects.vercel.app` | unique/git aliases **302 → Vercel SSO** | See 7.5 |
| Per-deploy `https://amrap-with-friends-<hash>-office-4354s-projects.vercel.app` | **302 → `vercel.com/sso-api`** | Do **not** treat as athlete entry; wildcard still will not complete auth behind SSO |

Also keep `http://127.0.0.1:5173` for local magic-link QA. Local `config.toml` still lists **3000**, which matches the hosted Site URL mistake but not Vite **5173** (the only allow-listed local origin).

### 7.5 Related: Vercel Authentication blocks preview (and unique production) hosts

Vercel deployment protection for `amrap-with-friends`:

- Password protection: **off**
- **Vercel Authentication (SSO): on**, `deploymentType: all_except_custom_domains`
- Trusted IPs: off

Confirmed: git-branch alias and unique `*.vercel.app` deploy URLs **302 to Vercel SSO**. Custom domain `www.amrapwithfriends.com` and the stable `amrap-with-friends.vercel.app` alias returned **200**.

If a new user opens a **preview / PR / unique deploy URL** (or a magic-link `emailRedirectTo` points there), they never reach AuthModal — they hit Vercel login. That presents as “I can’t create an account.” Athletes must use **`https://www.amrapwithfriends.com`**. Preview is for the Vercel team only.

### 7.6 Other Auth settings (verified)

| Field | Value | Notes |
| --- | --- | --- |
| `password_min_length` | 6 | Matches client + local config |
| `password_hibp_enabled` | false | Leaked-password check off |
| `mailer_allow_unverified_email_sign_ins` | false | — |
| `rate_limit_otp` | 30 | Per hour |
| `security_captcha_enabled` | false | — |

### 7.7 What remains unverified

- Gmail/corporate inbox delivery for magic-link mail (would send production email).
- Live duplicate-`signUp` body (empty identities vs `"User already registered"`). With Confirm email off, the latter is expected; was not probed to avoid creating throwaway production users.

---

## 8. Revised production diagnosis

After all live checks and the URL PATCH, the **primary blocker (misconfigured Site URL / allow-list) is resolved.** Remaining ranked causes:

1. **Default mailer + 2 emails/hour** — magic-link mail delayed, dropped, or rate-limited.
2. **Wrong host for athletes** — preview / unique Vercel URL behind SSO (7.5).
3. **Create account buried** — Sign in → Password tab; magic link creates users without passwords.
4. **Duplicate email** — raw Auth error instead of “Sign in instead.”
5. Session succeeds but **`/create` requires intake** — feels like signup failed.
6. (Latent) Confirm email ON without SMTP + `emailRedirectTo` + empty-identities handling.

**Still to do in Dashboard:**

1. Custom SMTP + raise email rate limit
2. Keep Confirm email **off** until mail is proven
3. Optionally add `https://amrapwithfriends.com/**` (apex 308s to www)
