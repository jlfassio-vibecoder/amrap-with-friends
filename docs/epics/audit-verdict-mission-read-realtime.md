# Pre-PR audit verdict — mission read / Realtime (Phases 0–3)

**Date:** 2026-08-31  
**Branch:** `claude/landing-page-update-uawasu`  
**Scope:** commits `8416d39` … `b61de92`  
**Verdict:** **RED — no-go** (do not open PR until must-fix items land)

---

## Summary

CI and the anon SELECT hole check out. Security review found no medium+ exploit in the intended design. Bugbot found a **high** entitlement gap that breaks authenticated joiner reclaim / new-device bootstrap after Phase 2, plus a **medium** live-sync freeze for signed-in athletes who are not yet membership-RLS eligible. Full guest/host UI smoke was not certified; RPC guest `create_mission` is not executable as anon on this project (`permission denied for function create_mission`), so happy-path smoke must be done in the app UI after fixes.

---

## Gate results

| Gate | Result |
| --- | --- |
| `npm run lint` | Pass (2 pre-existing warnings in `useCopyMissionInvite.ts`, not epic) |
| `npm run typecheck` | Pass |
| `npm run test` | Pass (144 files / 1105 tests) |
| Client `.from('missions'\|…)` grep | Pass (no hits in `src/`) |
| Anon `GET /rest/v1/missions` | Pass — **401** `permission denied for table missions` (2026-08-31T23:03:17Z) |
| Anon RPC without claim/host | Pass — `{ ok: false, reason: "invalid_claim_token" }` |
| Bugbot (Phases 0–3 focus) | **Fail** — 1 high, 1 medium (see below) |
| Security Review (Phases 0–3 focus) | Pass — no medium+ security findings |
| Manual UI smoke (guest + host) | **Not certified** — blocked / incomplete (see Smoke) |

---

## Architecture checklist (ADR)

| Item | Status |
| --- | --- |
| Path B: RPC snapshot + narrow Realtime | Pass |
| Segment results filtered by `mission_id` | Pass |
| Guest poll `GUEST_MISSION_POLL_MS`; auth `realtimeTables: isAuthenticated` | Pass (with medium caveat below) |
| Host Featured reclaim via `host_token` on live-state RPC | Pass (host path exists) |
| Hub subscribe waiting/setup/finished; drop work | Pass (`shouldSubscribeRallyPointOnMission`) |
| Waiting room surfaces `rallyPointChannel.error` | Pass |
| CLAUDE.md live-read exception | Pass |
| Claimed signed-in user can bootstrap via `auth.uid()` whenever they own the seat | **Fail** — see HIGH |

---

## Findings (must fix before GREEN)

### 1. HIGH — `auth.uid()` never considered when `claim_token_hash` is set

**Where:** [`supabase/migrations/20260902130000_mission_live_state_rls.sql`](../../supabase/migrations/20260902130000_mission_live_state_rls.sql) authorize block (~L83–96)

**Why it matters:** `join_mission` inserts **both** `user_id` and `claim_token_hash` for authenticated joiners. `resume_mission_identity` / reclaim returns `claim_token: null` (and only `host_token` for hosts). A joiner on a new device (or cleared `sessionStorage`) calls `get_mission_live_state` with no claim → claim branch fails → `auth.uid()` branch never runs → waiting-room bootstrap fails with `invalid_claim_token`.

**Required fix:** Allow `auth.uid() = participants.user_id` **in addition to** claim/host paths, even when `claim_token_hash` is still set (e.g. check uid match before or alongside claim hash). Align with product: owning the seat is enough for live read. Ship a follow-up migration (do not edit applied `02130000` in place if already pushed — add `02140000_…`).

### 2. MEDIUM — Signed-in but unclaimed guests lose live updates

**Where:** [`MissionWaitingRoomPage.tsx`](../../src/pages/MissionWaitingRoomPage.tsx) `realtimeTables: isAuthenticated`

**Why it matters:** Membership RLS requires `participants.user_id = auth.uid()`. Guest seats keep `user_id` null until claim. Signing in flips `isAuthenticated` → poll stops, Realtime registers but RLS yields no payloads → frozen timer/rounds/chat until claim.

**Required fix (pick one, prefer smallest):**

- Gate Realtime on membership, not merely auth session — e.g. keep polling whenever stored claim exists **or** when participant is not yet linked; **or**
- `realtimeTables: isAuthenticated && !getStoredClaimToken(missionId)` is wrong; better: poll unless we know `user_id` is linked (RPC flag) **or** always poll for guests and only skip poll when `is_mission_participant` would pass (client may not know) — simplest: **also poll when claim token is present**, even if authenticated; use Realtime as additive for claimed members only.

Recommended: `realtimeTables: isAuthenticated && !claimToken` is inverted logic; prefer:

```ts
realtimeTables: isAuthenticated && !getStoredClaimToken(missionId)
```

Wait - if they have claim token they should POLL (or both). If authenticated WITHOUT claim and user_id set, Realtime. If authenticated WITH claim (guest seat linked only by claim), POLL.

Actually: `realtimeTables: isAuthenticated && !getStoredClaimToken(missionId)` → auth + no claim → Realtime (claimed seats cleared claim from storage after claim_participant). Auth + still have claim → poll. Guest → poll. That matches.

Confirm claim_participant clears stored claim? If not, adjust. Document in fix PR.

---

## Smoke notes

| Path | Result |
| --- | --- |
| Guest create via anon RPC `create_mission` | Failed — `permission denied for function create_mission` (project grants; not a Phase 2 SELECT issue) |
| Full UI guest join → Start → work | **Not run** — RED already; re-run after HIGH/MEDIUM fixes |
| Host Start / Pass Command / daisy force-nav | **Not run** — same |

After fixes: run the epic’s two open acceptance smokes and tick them in [`mission-realtime-read-scoping.md`](./mission-realtime-read-scoping.md).

---

## Bugbot / Security tables

| Severity | Location | Finding |
| --- | --- | --- |
| high | `20260902130000_mission_live_state_rls.sql:83-96` | `auth.uid()` nested under `claim_token_hash IS NULL`; reclaim without claim fails |
| medium | `MissionWaitingRoomPage.tsx:434-439` | `realtimeTables: isAuthenticated` drops guest poll while RLS may still block |

Security Review: no medium+ findings on the intended hardening path (assuming migrations applied — confirmed on linked project for SELECT revoke).

---

## Decision

**RED no-go.** Do not open the Phases 0–3 PR until:

1. Live-state authorize accepts `auth.uid()` ownership even with claim hash present (migration + tests).
2. Waiting-room Realtime/poll gating fixed so signed-in unclaimed seats keep updating.
3. Guest + host UI smoke re-run and epic checkboxes updated.

Then re-run this audit’s CI + anon SELECT + smoke gates for **GREEN**.
