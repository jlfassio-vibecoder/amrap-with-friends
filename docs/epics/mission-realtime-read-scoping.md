# Epic: Mission read + Realtime scoping

**Status:** Phase 2 complete — SELECT hardened; Phase 3 (dual-channel hygiene) pending  
**Last updated:** 2026-08-31  
**Follows:** Close policy + Rally point / Next Mission vocabulary pass  
**Phase 0 ADR:** [`adr-mission-read-realtime-scoping.md`](./adr-mission-read-realtime-scoping.md)  
**Related surfaces:** [`useMissionChannel.ts`](../../src/lib/realtime/useMissionChannel.ts), mission waiting room (`/mission/:id`), guest-first live sync

---

## Vision

Live missions must stay fast for guests and hosts, without every connected phone reading or receiving **every** mission’s chat, scores, and round stream. Today guest-first Realtime was shipped with permissive SELECT and an unscoped segment-results listener — fine for a handful of concurrent workouts, not for production scale.

This epic hardens **who can read mission tables** and **which Realtime events reach which clients**, without collapsing the two-screen model (Rally point waiting room vs Next Mission hub) or forcing every workout through a durable hub.

> Knowing a mission UUID must not be enough to scrape every workout on the project. Realtime must fan out by mission, not by table.

---

## Why now

Architectural review of `/mission/:id` and `/rally-point/:id` ranked these as **P0 for scale/security** after product separation (close-while-live + vocabulary) landed:

| Gap | Risk |
| --- | --- |
| ~~Mission / participants / rounds / messages SELECT `USING (true)`~~ (Phase 2 fixed) | Was: UUID enumeration; now RPC entitlement + membership Realtime |
| ~~`participant_segment_results` Realtime with **no** `mission_id` filter~~ (Phase 1 fixed) | Was: every live client received all segment-result changes; now filtered by `mission_id` |
| Dual channels (mission + rally point) when linked | Cost/opacity; secondary to scoping but note fan-out while linked |

Column grants already omit secrets (`host_token`, claim hashes). That is necessary but not sufficient.

Migrations already flag the intent:

```sql
-- Copilot suggestion ignored: guest-first lobby needs permissive SELECT for anon Realtime;
-- scope via claim tokens in a hardening PR.
USING (true);
```

([`20260822120000_session_sync_rpcs.sql`](../../supabase/migrations/20260822120000_session_sync_rpcs.sql))

---

## Current state (baseline)

| Area | Today |
| --- | --- |
| Mission bootstrap | [`get_mission_live_state`](../../supabase/migrations/20260902130000_mission_live_state_rls.sql) via [`useMissionChannel`](../../src/lib/realtime/useMissionChannel.ts) |
| RLS | Anon SELECT revoked on live tables; authenticated membership via `is_mission_participant` |
| Realtime filters | Auth: filtered `postgres_changes`; guests: 5s poll of live-state RPC (hub pattern) |
| Segment results | `mission_id` denorm + Realtime/bootstrap `mission_id=eq.…` (Phase 1); JS roster guard kept as defense-in-depth |
| Writes | Still RPC-only (`update_mission_state`, `log_round`, claim, chat, etc.) — **do not regress** |
| Hub tables | `rally_points` / members: RPC + membership-gated Realtime — better model to emulate where possible |
| Product split | Waiting room = Rally point; hub = Next Mission — **out of scope for this epic** except not breaking live pull / force-nav |

---

## Goals

1. **Scoped reads:** A client can only SELECT mission rows it is entitled to (participant / valid claim / host path — exact predicate TBD in design spike).
2. **Scoped Realtime:** No unfiltered `postgres_changes` on high-churn tables; every subscription carries a mission- or participant-scoped filter (or a view that embeds that scope).
3. **Guest-first preserved:** Anon joiners with a claim token (or seat) still get live sync for **their** mission without signing in.
4. **No write-path rewrite:** Keep SECURITY DEFINER RPCs as the mutation boundary.
5. **Measurable fan-out drop:** Under N concurrent missions, segment-result and round event delivery to a given client is O(events in that mission), not O(global).

## Non-goals

- Attaching `rally_points` to featured/campaign/solo missions (separate product epic).
- Pass Command ownership UI cleanup.
- `announce_next` TTL / cancel.
- Moving all mission reads to RPCs-only if a scoped SELECT + Realtime path is cleaner (prefer the smallest change that meets goals; RPC bootstrap is an option, not a requirement).
- Renaming `/rally-point/:id` or waiting-room vocabulary (already settled).

---

## Master architecture (target)

```
Join / claim / host token
        ↓
Entitlement (participant row or verified claim)
        ↓
┌───────────────────────┬────────────────────────────┐
│ Initial snapshot      │ Realtime                     │
│ Scoped SELECT or RPC  │ Filtered postgres_changes    │
│ for this mission_id   │ or membership view           │
└───────────────────────┴────────────────────────────┘
        ↓
useMissionChannel (same consumer API)
```

### Design spike (complete — see ADR)

Lock one entitlement model before writing migrations:

| Option | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. RLS membership** | `EXISTS (participant for auth.uid()) OR claim_token path for anon` | Fits Realtime (RLS filters payloads) | Anon claim hard to express in RLS without a session GUC / signed JWT claim |
| **B. RPC snapshot + narrow Realtime** | `get_mission_live_state(mission_id, claim)` for bootstrap; Realtime only after join | Clear security boundary | Two code paths; claim must still authorize Realtime |
| **C. Mission-scoped views** | Views with `security_barrier` + grants; Realtime on views if supported | Cleaner filters | Supabase Realtime + view quirks; verify before committing |

**Locked by Phase 0 ADR:** **B** (RPC snapshot + narrow Realtime). **A** rejected (claim not in PostgREST/RLS context). **C** skipped unless B is blocked. Segment results: **denorm `mission_id`** (not `in.(participant_ids)`). See [`adr-mission-read-realtime-scoping.md`](./adr-mission-read-realtime-scoping.md).

### `participant_segment_results` specifically

**Shipped (Phase 1):** [`useMissionChannel.ts`](../../src/lib/realtime/useMissionChannel.ts) bootstrap and Realtime use `mission_id=eq.…`. Column filled by trigger/backfill in [`20260902120000_participant_segment_results_mission_id.sql`](../../supabase/migrations/20260902120000_participant_segment_results_mission_id.sql). Roster `participantIdsRef` guard remains defense-in-depth. Rejected as primary path: `participant_id=in.(…)` (roster churn + filter length at cap 100).

---

## Suggested phases

### Phase 0 — Spike + threat model (1–2 days) — **complete**

- Documented who may read: host, claimed user, anon with claim; product **no spectators**.
- Proved anon SELECT without claim (200 + rows) on hosted preview project; recorded in ADR.
- Locked **B** + denorm `mission_id`; rejected A/C.
- Deliverable: [`adr-mission-read-realtime-scoping.md`](./adr-mission-read-realtime-scoping.md). **No** production RLS revoke or live RPC cutover in this phase.

### Phase 1 — Segment-results Realtime scoping (P0) — **complete**

- Denorm `mission_id` + trigger/backfill; client bootstrap and Realtime use `mission_id=eq.…`.
- Fan-out model: [`segmentResultsFanOut.ts`](../../src/lib/realtime/segmentResultsFanOut.ts); log with `npx tsx scripts/log-segment-results-fanout.ts` (offline; O(events in this mission) at 10+ concurrent missions). Optional live Realtime soak against preview is out of CI.
- Acceptance: [`useMissionChannel.test.tsx`](../../src/lib/realtime/useMissionChannel.test.tsx) asserts every `participant_segment_results` listener has a non-empty `mission_id` filter.

### Phase 2 — SELECT / RLS hardening for mission tables (P0) — **complete**

- `get_mission_live_state` (claim / `auth.uid()` / host token); [`useMissionChannel`](../../src/lib/realtime/useMissionChannel.ts) bootstrap cut over.
- Anon SELECT revoked; authenticated membership RLS via `is_mission_participant`.
- Guest mitigation **(a)+(b):** auth Realtime when `realtimeTables: isAuthenticated`; guests poll every 5s (`GUEST_MISSION_POLL_MS`).
- Acceptance: anon without join/claim cannot SELECT mission rows; joined guest loads waiting room via RPC.

### Phase 3 — Ops / dual-channel hygiene (P1)

- Surface `rallyPointChannel.error` on the waiting room when linked.
- Consider dropping rally-point Realtime during finished unless force-nav/daisy need it.
- Acceptance: channel failure is visible; no silent Pass Command / force-nav degrade.

---

## Acceptance criteria (epic done)

- [x] Design spike ADR recorded (entitlement + segment-results approach) — [`adr-mission-read-realtime-scoping.md`](./adr-mission-read-realtime-scoping.md).
- [x] No unfiltered Realtime subscription on `participant_segment_results` (or successor path).
- [x] Mission table reads are entitlement-scoped; UUID alone is insufficient.
- [ ] Guest join → live waiting room → work still works without sign-in.
- [ ] Host Start / countdown / `log_round` / score lock unchanged in product behavior.
- [ ] Next Mission hub force-nav and daisy-chain still pull athletes into `/mission/:id`.
- [ ] Migration(s) + client tests; `npm run lint && npm run typecheck && npm run test` green.
- [x] CLAUDE.md architecture note: live mission reads are scoped (exception to “RPC-only” called out honestly if SELECT remains).

---

## Dependencies / risks

| Risk | Mitigation |
| --- | --- |
| Breaking anon Realtime when tightening RLS | Spike first; feature-flag or staged rollout on a preview project |
| `in.(uuid,…)` filter length at large rallies | Cap participants (already product-capped); or denorm `mission_id` |
| Replica identity / Realtime payload size | Keep column grants minimal; do not grant secret columns |
| Drift from CLAUDE “all access via RPC” | Prefer RPC snapshot if SELECT policies become unmaintainable |

---

## References

- Assessment context: mission waiting room vs Next Mission hub (close-while-live + vocabulary already shipped).
- [`useMissionChannel.ts`](../../src/lib/realtime/useMissionChannel.ts) — bootstrap + listeners.
- [`20260822120000_session_sync_rpcs.sql`](../../supabase/migrations/20260822120000_session_sync_rpcs.sql) — permissive policies + hardening comment.
- Hub contrast: [`useRallyPointChannel.ts`](../../src/lib/realtime/useRallyPointChannel.ts) — membership-gated reads / guest poll.
