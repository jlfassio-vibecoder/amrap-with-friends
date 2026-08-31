# Epic: Mission read + Realtime scoping

**Status:** Draft  
**Last updated:** 2026-08-31  
**Follows:** Close policy + Rally point / Next Mission vocabulary pass  
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
| Mission / participants / rounds / messages SELECT `USING (true)` | Anyone with a UUID (or who enumerates) can bootstrap full public columns via PostgREST |
| `participant_segment_results` Realtime with **no** `mission_id` filter | Every live client receives all segment-result changes project-wide; filters only in JS |
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
| Mission bootstrap | Direct `.from('missions' \| 'participants' \| 'rounds' \| 'messages')` in [`useMissionChannel`](../../src/lib/realtime/useMissionChannel.ts) |
| RLS | Permissive SELECT for anon/authenticated on those tables (renamed from sessions) |
| Realtime filters | `missions`, `participants`, `rounds`, `messages` filtered by `mission_id` / `id` |
| Segment results | Subscribe to **all** `participant_segment_results` events; client keeps rows whose `participant_id` is in the local set |
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

### Design spike (do first)

Lock one entitlement model before writing migrations:

| Option | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. RLS membership** | `EXISTS (participant for auth.uid()) OR claim_token path for anon` | Fits Realtime (RLS filters payloads) | Anon claim hard to express in RLS without a session GUC / signed JWT claim |
| **B. RPC snapshot + narrow Realtime** | `get_mission_live_state(mission_id, claim)` for bootstrap; Realtime only after join | Clear security boundary | Two code paths; claim must still authorize Realtime |
| **C. Mission-scoped views** | Views with `security_barrier` + grants; Realtime on views if supported | Cleaner filters | Supabase Realtime + view quirks; verify before committing |

**Recommendation to start:** Spike **A vs B** against current guest claim storage (`sessionStorage` claim token, not a DB session variable). If anon cannot safely prove claim to PostgREST, prefer **B** for bootstrap and keep Realtime filters on `mission_id` for tables that already have that column; for `participant_segment_results`, add `mission_id` (denormalized) or subscribe per `participant_id` once the roster is known.

### `participant_segment_results` specifically

Today ([`useMissionChannel.ts`](../../src/lib/realtime/useMissionChannel.ts) ~221–253):

- No filter on subscribe.
- Handler drops events whose `participant_id` ∉ local roster.

**Required outcome:** either

1. Denormalize `mission_id` onto `participant_segment_results` (trigger/backfill) and filter `mission_id=eq.…`, or  
2. After participants load, subscribe with `participant_id=in.(…)` (Supabase filter limits — document max roster size), or  
3. Deliver score updates via mission channel broadcast / RPC poll for that table only.

Pick one in the spike; (1) is usually the cleanest for Realtime at scale.

---

## Suggested phases

### Phase 0 — Spike + threat model (1–2 days)

- Document who may read: host, claimed user, anon with claim, spectator? (product: **no spectators** unless explicit).
- Prove anon entitlement against PostgREST/Realtime.
- Choose A/B/C and segment-results approach.
- Acceptance: short ADR in this folder or a subsection below; no production cutover yet.

### Phase 1 — Segment-results Realtime scoping (P0)

- Implement chosen filter/denorm.
- Load test / log: event rate per client with 10+ concurrent missions.
- Acceptance: client never registers an unfiltered `participant_segment_results` listener; tests cover filter wiring.

### Phase 2 — SELECT / RLS hardening for mission tables (P0)

- Replace `USING (true)` with entitlement-aware policies (or RPC-only snapshot + revoke SELECT).
- Update [`useMissionChannel`](../../src/lib/realtime/useMissionChannel.ts) bootstrap accordingly.
- Acceptance: unauthenticated request **without** join/claim cannot `SELECT` another mission’s rows; joined guest still loads waiting room; host push/joiner tick still work.

### Phase 3 — Ops / dual-channel hygiene (P1)

- Surface `rallyPointChannel.error` on the waiting room when linked.
- Consider dropping rally-point Realtime during finished unless force-nav/daisy need it.
- Acceptance: channel failure is visible; no silent Pass Command / force-nav degrade.

---

## Acceptance criteria (epic done)

- [ ] Design spike ADR recorded (entitlement + segment-results approach).
- [ ] No unfiltered Realtime subscription on `participant_segment_results` (or successor path).
- [ ] Mission table reads are entitlement-scoped; UUID alone is insufficient.
- [ ] Guest join → live waiting room → work still works without sign-in.
- [ ] Host Start / countdown / `log_round` / score lock unchanged in product behavior.
- [ ] Next Mission hub force-nav and daisy-chain still pull athletes into `/mission/:id`.
- [ ] Migration(s) + client tests; `npm run lint && npm run typecheck && npm run test` green.
- [ ] CLAUDE.md architecture note: live mission reads are scoped (exception to “RPC-only” called out honestly if SELECT remains).

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
