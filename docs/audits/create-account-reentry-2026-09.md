# Create-account workflow — architectural assessment and re-entry gap analysis

**Date:** 2026-09-02  
**Trigger:** Multiple people tried to join and could not create an account, or created one and could not get back in. Immediate incident: a user created an account, then failed sign-in — likely a browser auto-generated password they never saw, or a misspelled password they cannot recover.  
**Prior audit:** [create-account-workflow.md](./create-account-workflow.md) (2026-08-27) — hosted SMTP, Site URL, redirect allow-list, Vercel SSO. This document is the current product/architecture picture and the re-entry hole that audit left as “out of scope.”

**Vocabulary:** “Create account” is the UI label. A **session** is an auth session. A **mission** is a workout.

---

## 1. What “having an account” means

There is no `/signup` route. Account creation is a mode of [`AuthForm`](../../src/components/AuthForm.tsx), opened from the header, homepage hero, or a gate (`RequireIntake`, join campaign/squad, post-mission save).

A usable account is three stacked layers. The form only implements the first.

| Layer | Where | Required to… |
| --- | --- | --- |
| Auth user + session | Supabase Auth (`signUp` / `signInWithPassword` / `signInWithOtp`) | Exist as a user and stay signed in |
| Email confirmed | Hosted Auth “Confirm email” (was **OFF** in Aug 2026; local `enable_confirmations = false`) | Sign in, if confirmations are on |
| Athlete profile | `/intake` → `athlete_profiles` | Create missions, campaigns, squad — not required to exist as a user |

A user can succeed at “Create account,” see **Account created.**, have the modal close, and still feel locked out because:

1. They cannot reproduce the password on the next visit (this incident).
2. They land on `/create` and are bounced to intake with no explanation that signup already worked.
3. They used magic link (creates a passwordless user) and later try password sign-in.

```mermaid
flowchart TD
  click[Header Create account / homepage compact / gate modal]
  form[AuthForm password sign-up]
  signup["supabase.auth.signUp no emailRedirectTo"]
  session{Session issued?}
  created[Account created modal closes]
  noSession[Check email then sign in]
  later[Later visit or new device]
  signIn[Sign in with password]
  match{Password matches?}
  in[Signed in]
  fail["Error: Invalid login credentials"]
  deadEnd[No forgot-password no confirm field no magic-link fallback on compact]

  click --> form --> signup --> session
  session -->|yes| created --> later --> signIn --> match
  session -->|user no session| noSession
  match -->|yes| in
  match -->|no| fail --> deadEnd
```

---

## 2. Current architecture

### 2.1 Surfaces

| Surface | File | What the athlete sees |
| --- | --- | --- |
| Header | [`AuthHeaderActions.tsx`](../../src/components/AuthHeaderActions.tsx) | **Sign in** and **Create account** — Create account opens the modal on password sign-up |
| Homepage hero | [`HeroBelowLogo.tsx`](../../site/islands/HeroBelowLogo.tsx) | Compact `AuthForm`: password only, Sign in / Create account pills, **no magic link**, **no heading** |
| Gated routes | [`RequireIntake.tsx`](../../src/components/RequireIntake.tsx) | Auto-opens `AuthModal` on **Sign in** (magic link default if enabled) |
| Join campaign / squad | Those pages | Modal; guest copy off where an account is required |
| Post-mission save | [`MissionWaitingRoomPage.tsx`](../../src/pages/MissionWaitingRoomPage.tsx) | **Save to my account** → modal, then `claim_participant` |
| Profile | [`IntakePage.tsx`](../../src/pages/IntakePage.tsx) | Change email / password **only if already signed in**. Signed-out `/intake` is a dead end: “Sign in to set up your profile” + link home — no form |

### 2.2 Client stack

- [`AmrapAuthProvider.tsx`](../../src/contexts/AmrapAuthProvider.tsx) — `getSession` + `onAuthStateChange`; `user !== null` is authenticated.
- [`supabase.ts`](../../src/lib/supabase.ts) — `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`. Session lives in **localStorage**, not cookies. New device / cleared storage = must sign in again.
- Password policy: [`passwordPolicy.ts`](../../src/lib/auth/passwordPolicy.ts) — **min 6 characters**, no complexity, no confirmation field.
- Magic link: [`authFeatures.ts`](../../src/lib/auth/authFeatures.ts) — `VITE_AUTH_MAGIC_LINK_ENABLED` defaults to **true**. Homepage compact form hides it; the modal still shows it first unless opened as Create account.

### 2.3 Create vs sign-in APIs

```ts
// signUp — no emailRedirectTo
await supabase.auth.signUp({ email, password });

// sign-in
await supabase.auth.signInWithPassword({ email, password });

// magic link — creates a user by default (SDK shouldCreateUser: true)
await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
```

Outcomes of `signUpWithPassword`:

| Supabase result | UI |
| --- | --- |
| `data.session` | “Account created.” then `onAuthenticated` closes the modal |
| `data.user` and no session | “Check your email to confirm your account, then sign in.” — fields **disabled** |
| Error | Raw `Error: {message}` (e.g. `User already registered`, `Invalid login credentials`) |

There is **no** `resetPasswordForEmail`, no `/forgot-password` route, and no “Forgot password?” link. README still lists forgot-password as **out of scope**.

---

## 3. Incident: created an account, cannot get back in

This is the most likely path for the user you just watched.

### 3.1 What the code does at create time

On password **Create account**:

- Single password field. No “Type it again.”
- `autoComplete="new-password"` — browsers and password managers **will** offer or inject a generated password.
- Show/hide eye exists on `AuthForm`, but:
  - Compact homepage field is short; generated passwords are often 16–20+ characters and **overflow** the input.
  - After success the field is **disabled** (`status === 'success'`) so they cannot reveal it.
  - Immediate session → modal **closes** (`onAuthenticated`). The password they never read is gone.
- Hint is only “At least 6 characters.” Nothing says “you will need this to sign in again” or “save this in a password manager.”
- Success copy is **Account created.** — no “you’re signed in” vs “remember this password.”

### 3.2 What happens on the next visit

Session is localStorage on **that** browser. A new phone, private window, cleared site data, or another device requires the password.

Sign-in uses `autoComplete="current-password"`. If the manager saved the generated password, they get in. If they:

- dismissed the save prompt,
- typed a password they later mistype (no confirm field),
- thought the browser-filled string was a placeholder,
- created on one surface (homepage compact) and sign in on another (modal),

then GoTrue returns **`Invalid login credentials`**, shown verbatim as `Error: Invalid login credentials`. That string does not say “wrong password,” “account exists,” or “reset it.”

There is **no recovery**:

| Recovery option | Status |
| --- | --- |
| Forgot password / email reset | Not implemented |
| Confirm-password at signup (catch typo) | Not implemented |
| Stay signed in across devices | No cookies / no SSO |
| Magic link as fallback | Hidden on homepage; default in modal **if** SMTP delivers |
| Admin reset | Dashboard only |
| Intake “change password” | Requires being signed in already |

**This is a product dead end, not a support script.** The account exists. The athlete is locked out. A second **Create account** attempt returns `User already registered` (confirmations off) or a fake “check your email” (confirmations on — empty `identities`). Both look like “I can’t create an account.”

### 3.3 Why it also looks like “create account failed”

Reports collapse three distinct failures into one sentence:

| What happened | What they report |
| --- | --- |
| Signup succeeded; later sign-in fails (this incident) | “I created an account and can’t get in” |
| Duplicate email / already registered | “It won’t let me create an account” |
| Magic-link mail never arrived (default mailer, 2 emails/hour) | “I never got the email” / “signup doesn’t work” |
| Session ok, `/create` demands intake | “I signed up and nothing happened” |
| Preview / unique Vercel URL behind SSO | “The site asked me to log into Vercel” |

---

## 4. Gap analysis

Severity: **P0** blocks create or re-entry; **P1** high confusion; **P2** polish.

### P0 — No password reset (this incident)

A forgotten, unseen, or mistyped password cannot be recovered in the product. README already named this follow-up; it is now the primary user-facing failure.

**Fix:** Ship `resetPasswordForEmail` + a `/reset-password` (or hash-token) page that calls `updateUser({ password })`. Link **Forgot password?** from the Sign in form. Requires working SMTP (see prior audit §7.2 — production was still default mailer at 2 emails/hour). Do not ship reset until mail delivers.

### P0 — No confirm-password on Create account

A single field plus `new-password` autofill is how people lock themselves out on day one.

**Fix:** Second field on sign-up only (“Type it again”). Client-check mismatch before `signUp`. Keep show/hide. After create, do not disable the field until they have had a chance to save it — or show a one-time “password saved to this browser?” confirmation.

### P0 — Success state hides the password then closes — done 2026-09-02

`status === 'success'` disables inputs; `onAuthenticated` closes the modal when a session exists. The athlete never sees the generated password again.

**Fix:** On first session after sign-up, keep the modal open long enough to say “You’re signed in. This browser will remember you. On another device you’ll need this password — or use Forgot password.” Do not auto-close in under a second.

### P0 — Magic-link mail still the modal default (when enabled) — done 2026-09-02

`AuthModal` defaults `initialPasswordMode` to sign-in, which selects the **Magic link** tab when `VITE_AUTH_MAGIC_LINK_ENABLED` is unset/true. Magic link **creates** users (`shouldCreateUser: true`) with **no password**. Those users cannot use Password → Sign in. Password → Create account then hits duplicate-email.

Prior audit: custom SMTP was **not** configured; rate limit **2 emails/hour**. Magic-link “create” is the worst default until mail is proven.

**Fix:** Default modal to **Password**. Set `shouldCreateUser: false` on OTP, or copy: “Email me a sign-in link (works if you already have an account).” Disable magic link in Vercel (`VITE_AUTH_MAGIC_LINK_ENABLED=false`) until SMTP is live.

### P1 — Duplicate signup / empty identities

`signUpWithPassword` treats any `data.user` without `data.session` as confirmation sent. When Confirm email is ON, a second attempt returns a user with **empty identities** and no mail. UI says “Check your email…”. When Confirm email is OFF, they get raw `User already registered`.

**Fix:** If `user.identities?.length === 0`, show “An account with this email already exists. Sign in or reset your password.” Map `User already registered` to the same string. Add a provider test (today only mocks the explicit error).

### P1 — `signUp` has no `emailRedirectTo`

Magic link passes `origin + pathname`. Password sign-up does not. Confirmation links use Dashboard Site URL. Latent until Confirm email is turned on.

**Fix:** Pass the same `emailRedirectTo` (or `/auth/callback?next=`) on `signUp`.

### P1 — Account ≠ ready to train

`RequireIntake` redirects a brand-new session to `/intake?next=…`. Header Create account does not. Users who thought signup was the whole job bounce on `/create`.

**Fix:** After first session, if profile is missing, navigate to `/intake?next=/create`.

### P1 — Signed-out `/intake` and signed-out gates

`/intake` when signed out has no `AuthForm`. Gates reopen with a **Sign in** button only (not Create account). Compact homepage is the friendliest create path; join/create gates are not.

**Fix:** Mount `AuthForm` on signed-out intake; gate reopen button should offer Create account when the route requires an account.

### P1 — Raw GoTrue errors

`Invalid login credentials` is the re-entry message. It does not invite reset. `Email not confirmed` is unmapped.

**Fix:** Map known codes to athlete-facing copy + a Forgot password action.

### P2 — Intake password change is a poor recovery tool

`/intake` can update password only while signed in. No show/hide, no min-length hint in the UI, `autoComplete="new-password"`. Useless for the locked-out user.

### P2 — No funnel telemetry

`track()` is not fired for `auth_sign_up_*` / `auth_sign_in_failed`. “People can’t join” cannot be counted.

**Fix:** Events for attempt / success / needs_confirmation / `invalid_credentials` (never log emails).

### P2 — Config drift

Hosted Confirm email, SMTP, Site URL, and min password are Dashboard-only. A toggle can break signup without a deploy. Prior audit patched Site URL and allow-list (2026-08-28). Re-verify before treating those as current.

---

## 5. Intended journeys vs what the code does

| Intent | Click | System | Risk |
| --- | --- | --- | --- |
| Make an account | Header **Create account** | Modal, password sign-up | Autofill password; modal closes; no confirm |
| Make an account | Homepage compact | Password pills, no magic link | Same autofill/typo hole; easiest path today |
| Make an account | Gate **Sign in** | Magic link default (if enabled) | Mail never arrives; or passwordless user |
| Come back tomorrow | Header **Sign in** | Password or magic link | Wrong password → dead end |
| I forgot my password | (nothing) | — | Support / Dashboard only |
| Create a mission | `/create` | Auth + intake | Feels like signup failed |
| Save a guest mission | Scorecard **Save to my account** | Modal then claim | Finished “sign up is optional” banner only shows when **already** authenticated |

---

## 6. Recommended work (order)

Ship recovery **before** turning Confirm email on or leaning on magic link.

1. **Forgot password** — `resetPasswordForEmail` + in-app set-new-password page. Block on custom SMTP + a real email rate limit (prior audit §7.2).
2. **Confirm password** on Create account; do not auto-close the success modal until the athlete has seen a “you’re signed in / you’ll need this password” line.
3. **Default the modal to Password**; hide or demote magic link until SMTP is proven (`VITE_AUTH_MAGIC_LINK_ENABLED=false` in production).
4. **Map duplicate / invalid-credentials** to “Account exists — sign in or reset password.” Detect empty `identities`.
5. **Pass `emailRedirectTo` on `signUp`.** After first session, send missing-profile users to `/intake`.
6. **Telemetry** on signup/signin outcomes so the next “people can’t join” report has counts.

---

## 7. Manual QA for this incident class

1. Chrome: Create account with the **suggested** password. Do **not** save to the password manager. Sign out. Sign in with what you think you typed. Expect today’s `Invalid login credentials` and no reset link.
2. Create account, mistype a 6-character password (no confirm). Sign out. Try the intended password. Same dead end.
3. Create account, then Create account again on the same email. Expect raw `User already registered` (confirmations off) or “check your email” (confirmations on).
4. Magic link (if enabled): create via OTP, then Password → Sign in. Expect failure; no password was ever set.
5. New device / private window after a successful signup on another browser. Expect password prompt; localStorage session does not travel.

---

## 8. What this document does not re-verify

Hosted Dashboard values from 2026-08-27/28 (Confirm email OFF, default SMTP, 2 emails/hour, Site URL patched to `www.amrapwithfriends.com`) are **not** re-probed here. Re-run those checks before enabling Confirm email or shipping password-reset mail. See [create-account-workflow.md](./create-account-workflow.md) §7.
