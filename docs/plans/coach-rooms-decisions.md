# Coach's Rooms — Phase 0 decisions

_Recorded 10 September 2026 · [feature plan](coach-rooms-feature-plan.md) (what and why) ·
[roadmap](coach-rooms-roadmap.md) (in what order)_

The questions the roadmap flagged as "decide before writing code, because
everything downstream forks on them." Each has a recommendation and the reason.
**None is signed off** — override any of them here and the rest of the build
follows this file.

§1–3 are Phase 0's three. §4 was raised later, by Phase 2a shipping a room page
with no athlete-facing activity list, and is recorded here because it forks the
same way.

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

## 4. The public activity feed names members and counts everyone

_Decided 11 September 2026, against two stated criteria: encourage account
creation, and make sure guests come back._

**Decision:**

| Who                                             | On the public `/@handle` feed | Counted in "N athletes finished" |
| ----------------------------------------------- | ----------------------------- | -------------------------------- |
| Member, `activity_visible = true` (the default) | Named                         | Yes                              |
| Member, opted out                               | Unnamed row                   | Yes                              |
| Guest — no membership row                       | Unnamed row                   | Yes                              |

`room_members.activity_visible` is a **member** setting and means exactly one
thing: _show my name in this room's public activity_. It has existed since the
boundary migration with no reader; this is the reader.

**Guests do not get the setting, because the guest state already is the private
state.** That is the whole answer to "what does `activity_visible` mean for
someone with no membership row" — nothing, because there is no name being
published to hide. A guest is at the more private setting by construction, and
a column on a row they do not have cannot make them more private than that.

### Unnamed, not omitted — this is the part that serves both criteria

Omitting guests is the tempting default and it fails twice over. It makes the
feed **dishonest**: a room that ran twenty athletes, most of them guests, would
render as a room that ran six, which argues against joining it. And it makes
the feed **discouraging** to the one person the room loop is built to convert —
a guest who finishes, opens the room page, and finds no trace of the thing they
just did has been told their effort did not count.

An unnamed row says the opposite. The guest watches their own result land on
their coach's page, and the single thing missing is their name.

That is also the strongest account-creation pitch the room has, because it is
true and specific rather than generic. **The client already knows which row is
its own** — `getStoredParticipantId(missionId)` in `missionIdentity` — so the
page can mark _this one is you_ locally, without publishing anything and
without the server knowing who is looking. The prompt lands on exactly the
person it should, and it says the honest thing: the name is what the account
buys.

### Claiming names what you already did

A guest who claims into an account with the room box ticked has their past
finishes **in that room** become named. This is the payoff, and it is a much
better offer than "create an account": it does not ask for a leap of faith
about future value, it points at work already on the page.

It also publishes a name that was previously anonymous, so the sheet must say
so before the tick, not after. A retroactive change to a public page is exactly
the kind of thing that must be consented to rather than discovered.

### Default-on for members, but only with a one-tap opt-out next to the names

Opt-in leaves every feed empty, which removes the reason the feed exists.
Joining a room is already a deliberate act aimed at one coach, so default-on is
the honest reading of what the athlete asked for. That is only defensible while
the opt-out is one tap and visible **where the names are** — not buried in a
settings page the athlete has no reason to open.

### The host's view does not change, and the boundary is not member-vs-guest

`list_room_finishes` stays host-only, stays named, and keeps including guests.
The coach already sees every nickname live on the participants panel while the
mission runs; publishing to the open web is the new thing, not the coach
seeing it. **The boundary is public-vs-host.** Nobody should later "fix" the
apparent inconsistency of a guest being named to their coach and unnamed to
the world — that difference is the design.

### There is a deadline on this, and a promise already shipped

Two surfaces currently tell athletes the audience is the coach:

- `src/pages/RoomPage.tsx` — "Joining lets this coach see the missions you
  finish in their room."
- `joinNote()` in `src/lib/rooms/postFinish.ts` — "<Room> will see the missions
  you finish in their room."

A public, named feed makes both false. **Today that costs nothing: there are
zero rooms in production**, so nobody has joined under that promise. It stops
being free the day the first founding host onboards, after which anyone who
joined under "this coach" must stay unnamed and the fix is a backfill rather
than a copy change. Ship the copy in the same commit as the feed, or do not
ship the feed.

### Consequences

- A new public read — anon-executable, unlike host-only `list_room_finishes` —
  returns a name only for a member with the flag set. Never a `user_id`, and
  never a guest's nickname.
- It must return `participant_id` so a guest's own device can recognise its
  row. That id is a bare uuid and identifies nothing on its own, but it is
  newly public: check at build time that nothing else public joins against it.
- Counting stays as `room_activity_summary` already does it, deliberately
  including guests (`20260912110000_room_activity_counts_guests.sql`).
  `returning_athletes` still must not, because two guest finishes cannot be
  shown to be the same person and inventing a returner would corrupt the
  pilot's primary metric.

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
