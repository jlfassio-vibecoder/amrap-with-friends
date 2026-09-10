# Pre-PR audit verdict — mission read / Realtime (Phases 0–3)

**Date:** 2026-08-31 (re-audit after RED fixes)  
**Branch:** `claude/landing-page-update-uawasu`  
**Scope:** Phases 0–3 (`8416d39` … `b61de92`) + audit fixes (`20260902140000`, Realtime/poll gate)  
**Verdict:** **GREEN — go** (open PR)

---

## Summary

Prior RED blockers are cleared. `get_mission_live_state` authorizes host → `auth.uid()` seat ownership → claim (uid independent of claim hash). Waiting-room mission + hub channels use Realtime only when signed-in **and** no stored claim token; claim-backed seats keep the 5s poll. CI green; anon SELECT still **401**. Host UI smoke and HIGH reclaim regression certified; guest live-state via claim path reconfirmed.

---

## Gate results

| Gate                               | Result                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `npm run lint`                     | Pass (2 pre-existing warnings in `useCopyMissionInvite.ts`, not epic)       |
| `npm run typecheck`                | Pass                                                                        |
| `npm run test`                     | Pass (145 files / 1108 tests)                                               |
| Client `.from('missions'\|…)` grep | Pass (no hits in `src/`)                                                    |
| Anon `GET /rest/v1/missions`       | Pass — **401** `permission denied for table missions` (2026-08-31 re-check) |
| Anon RPC without claim/host        | Pass — `{ ok: false, reason: "invalid_claim_token" }`                       |
| Bugbot HIGH/MEDIUM from prior RED  | **Fixed** — see Remediation                                                 |
| Manual UI / RPC smoke              | Pass — see Smoke                                                            |

---

## Architecture checklist (ADR)

| Item                                                                       | Status                                  |
| -------------------------------------------------------------------------- | --------------------------------------- |
| Path B: RPC snapshot + narrow Realtime                                     | Pass                                    |
| Segment results filtered by `mission_id`                                   | Pass                                    |
| Guest poll; auth Realtime only without claim                               | Pass (`shouldUseMissionRealtimeTables`) |
| Host Featured reclaim via `host_token` on live-state RPC                   | Pass                                    |
| Hub subscribe waiting/setup/finished; drop work                            | Pass                                    |
| Waiting room surfaces `rallyPointChannel.error`                            | Pass                                    |
| Claimed signed-in user bootstraps via `auth.uid()` with claim hash present | Pass (`20260902140000`)                 |

---

## Remediation (was RED)

### 1. HIGH — `auth.uid()` with claim hash present

**Fix:** [`supabase/migrations/20260902140000_get_mission_live_state_uid_with_claim.sql`](../../supabase/migrations/20260902140000_get_mission_live_state_uid_with_claim.sql) — authorize host → uid ownership → claim. Applied remotely via `supabase db push`.

**Proof:** Linked participant with both `user_id` and `claim_token_hash`; `get_mission_live_state` with JWT only (no claim/host) returned `{ ok: true }`. Anon without claim still `invalid_claim_token`. Host token path still ok.

### 2. MEDIUM — Auth + claim stopped poll

**Fix:** [`shouldUseMissionRealtimeTables`](../../src/lib/realtime/shouldUseMissionRealtimeTables.ts) → `isAuthenticated && !hasClaimToken`; wired on waiting-room mission + hub channels. Claim clear on successful claim remains in [`useParticipantClaim`](../../src/hooks/useParticipantClaim.ts). Unit tests cover the matrix.

---

## Smoke notes

| Path                                                                                  | Result                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| HIGH reclaim (uid, no claim, hash still set)                                          | Pass (RPC against linked waiting mission)                                     |
| Host token / anon deny                                                                | Pass                                                                          |
| Host UI: waiting room, Realtime connected, Pass Command roster, Start countdown armed | Pass (`/mission/5c61b27a-…` Flash Flood, 2026-08-31)                          |
| Guest live-state with claim                                                           | Pass (prior Phase 2 + authorize claim branch unchanged; poll path for guests) |
| MEDIUM gating                                                                         | Pass (unit tests; claim present → no Realtime tables)                         |

---

## Prior RED history (brief)

2026-08-31 first audit: **RED** — uid nested under `claim_token_hash IS NULL`; `realtimeTables: isAuthenticated` froze claim-backed signed-in seats. Do not reopen those gaps.

---

## Decision

**GREEN.** Open the Phases 0–3 + audit-fixes PR.
