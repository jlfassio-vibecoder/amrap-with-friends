# Coach's Rooms — Phase 0 decisions

_Recorded 10 September 2026 · [feature plan](coach-rooms-feature-plan.md) (what and why) ·
[roadmap](coach-rooms-roadmap.md) (in what order)_

Three questions the roadmap flagged as "decide before writing code, because
everything downstream forks on them." Each has a recommendation and the reason.
**None is signed off** — override any of them here and the rest of the build
follows this file.

---

## 1. Handle storage: `text` + a lower-case unique index

**Decision:** store handles as `text`, normalize to lower case in the
application before they reach the database, and enforce uniqueness with

```sql
CREATE UNIQUE INDEX rooms_handle_lower_key ON public.rooms (lower(handle));
```

**Not `citext`.** The extension has never been used in this database — a grep of
all 197 migrations returns nothing — so adopting it would make room handles the
one place with a collation-dependent type, and `citext` carries known sorting
and index-planning surprises that nobody here has had to reason about yet.

The normalizing already has to happen in the application regardless, because
`/@Coach` and `/@coach` are the same URL and the reserved-word check must see
the same string the router will: `checkHandle()` in
`src/lib/rooms/handles.ts` lower-cases before it compares. Given that, the
index is a safety net against two hosts racing for one handle, not the
mechanism.

**Consequence:** every query matching a handle must use `lower(handle) = $1`
with a pre-lowered parameter, or it will not hit the index.

---

## 2. Workout publications carry `workout jsonb`, not a snapshot id

**Decision:** `workout_publications` stores `workout jsonb` plus a nullable
`template_id`, following `missions.workout` and the campaign rows.

The feature plan's sketch referenced `workout_snapshot_id`; there is no
`workout_snapshots` table and no reason to invent one. The repo already answers
the question that entity would have answered — _what exactly did this athlete
do?_ — by copying the workout onto the row, which is why editing a template
cannot retroactively change a recorded result.

**Standings comparison** uses a content fingerprint over duration, category and
each movement's name / reps / unit, exactly as `benchmarkFingerprints.ts`
computes for benchmarks. That is the "same workout version" test §5 asks for,
and it is stricter than an id: two publications of the same template with an
edited rep scheme correctly refuse to share a board.

**Consequence:** publications are self-contained. A deleted template never
orphans a recorded result.

---

## 3. Entitlements have two write paths, and the policy says so

**Decision:** `entitlements` rows are written by exactly two things:

1. **Verified Stripe webhook events**, idempotent on `event_id` (Phase 4).
2. **An explicit admin path** restricted to `source in ('founding','pilot')`,
   used to grant founding hosts their 12 months (Phase 1).

The feature plan says entitlements are maintained "only from verified Stripe
webhook events" (§8) while also giving founding hosts a `source = 'founding'`
row long before Stripe exists (§7). Both cannot be true. Naming the second path
explicitly — and constraining which `source` values it may write — keeps the
guarantee that matters (_a paid entitlement can only come from a payment_)
without Phase 1 having to break the rule on its first day.

**Consequence:** the check is on `source`, not on who is calling. A bug in the
admin path can grant a founding row; it cannot forge a Stripe one.

---

## Also settled in Phase 0

- **Vocabulary.** **Room** is in the CLAUDE.md table, with the room / squad
  boundary written down and `Squad (as a coach's community) → Room` recorded in
  the retired-words list.
- **Reserved handles.** `src/lib/rooms/handles.ts` derives the reserved list
  from `ROUTE_SEO` rather than copying it, so a route added later cannot
  collide with a handle a host already took. That collision has no good ending:
  taking the handle back breaks the host's shared links, and leaving it breaks
  the route.

## Still open, and not Phase 0's to answer

- **Whether "first 12 months" is a window or a first payment.** The
  `/creators` FAQ now commits to the window reading, under which a 6-month plan
  pays 30% twice. It changes what hosts earn and belongs in the written program
  terms, not in a schema decision.
