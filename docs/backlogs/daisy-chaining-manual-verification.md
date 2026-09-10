# Daisy-chaining manual verification

Live exit criteria for Phases 2–6. Code is shipped; this file is the runbook.
Migrations through `20260901300000` must be applied. Use the current Vercel
preview or local app.

AFK claim and Pass Command require signed-in users (`auth.uid()`).

## Timing constants

| Mechanism        | Value            | Notes                                           |
| ---------------- | ---------------- | ----------------------------------------------- |
| Host heartbeat   | 15s              | Staging + waiting/setup `touch_lobby_presence`  |
| AFK grace        | 45s              | `claim_lobby_command_if_stale` / successor pick |
| Claim poll       | immediate + ~20s | `useStaleLobbyHostClaim`                        |
| Soft force-nav   | 5s banner        | “Next session starting — Join now”              |
| Guest lobby poll | 5s               | Guests have no table Realtime; `get_lobby` poll |

Expected AFK handoff window after host tab close: **~45–65s**.

## Setup

1. **Host A** and **Member B** — two browsers (or normal + private), both signed in.
2. Optional **Guest C** — signed out, for soft force-nav / guest poll path.
3. A creates a session, shares the rally link (`/join?l=`); B joins.
4. Navigate both to staging (`/lobby/:id`) when between missions.
5. Confirm both appear under **The crew** with presence (**Here** / **Away**).

## Results log

| Date       | Environment (preview URL / local)             | Tester | Overall                                                                                           |
| ---------- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| 2026-08-30 | Checklist authored; live A–F not run in-agent | Agent  | **Blocked** — needs two signed-in browsers (Host A + Member B). Tick boxes below when you run it. |

Agent limitation: AFK claim, Pass Command, presence across tabs, and soft force-nav all require concurrent authenticated (or guest) sessions the coding agent cannot supply. Unit/RPC coverage already exists; this checklist is the remaining live gate.
---

## Checklist

### A — Presence (two-browser)

- [ ] A and B both on staging: each sees the other as **Here**.
- [ ] A backgrounds the tab ~20s+: B sees A **Away** (or after presence timeout); A returns → **Here** again.
- [ ] Heartbeat: A stays on staging >45s without closing → B does **not** become host.

### B — AFK host handoff (~45–65s)

- [ ] A and B on open staging; A **closes the tab** (do not Leave).
- [ ] Within ~45–65s, B gains **Host** and can use **Start next** / Pass.
- [ ] A’s old controls are gone if they reopen (or they rejoin as member).

### C — Soft force-nav / banner

- [ ] A and B finish a mission (or use finished scorecard); both can reach staging.
- [ ] B stays on finished scorecard (partials closed). A on staging starts next session.
- [ ] B sees **“Next session starting — Join now”**, auto-nav after ~5s (or sooner via Join now).
- [ ] With partials modal still open on B: no force-nav until dismissed; then banner/nav proceeds.
- [ ] Guest C on staging: still force-navs within ~5–10s (poll path; no table Realtime).

### D — Host stays host while arming countdown

- [ ] A (host) on `/session` waiting/setup with lobby linked; B remains on staging.
- [ ] A arms countdown and waits >45s on the waiting room (heartbeat active).
- [ ] B does **not** claim host; A retains Start / countdown controls.

### E — No mid-`work` claim

- [ ] Session in **Live** (`work`); A is host; B on staging or session.
- [ ] A closes tab or goes dark >65s.
- [ ] B does **not** become host; session stays “Waiting on host for session control” (or equivalent). No Start next / Pass for B mid-workout.

### F — Smoke (quick)

- [ ] Pass Command on waiting room: A → B; B arms countdown; A loses host chrome without refresh.
- [ ] Leave staging (last host, no successor) closes lobby; Leave with successor reassigns without closing.

---

## Failure notes

If a box fails, record here: scenario, browser, approx timing, expected vs actual.
Prefer a surgical fix PR — do not reopen deferred epic items (guest-as-host,
mid-workout failover, empty-lobby TTL).

## Explicit non-goals

- Automating this suite in CI
- Campaign / featured / makeup paths
- Changing grace, caps, or RLS in this checklist
