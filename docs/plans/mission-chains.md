# Plan: mission chains built before the first Start

**Branch:** `feature/mission-chains`
**Status:** Approved — Phases 1–3 shipped
**Last updated:** 2026-09-06
**Depends on:** `feature/expanded-time-caps` (chain items carry a cap, not just a domain)

---

## Verdict in one paragraph

Daisy-chaining exists, but only reactively: the host reaches the Next Mission hub
after a workout ends and picks what is next while everyone waits. This feature
moves that decision to before the first Start — the host builds an ordered list
of missions in Create, and the app runs them back to back with a rest between
each. The rest is not a new screen or a new timer. It is the rally point
countdown that already exists, armed automatically when the next mission is
created, which means the whole "rest period" is one new column's worth of
behaviour on top of UI that already ships. The genuinely new parts are a queue
table, a builder in Create, and one pure function that decides how long the rest
is.

---

## What the host gets

1. In Create, a **chain builder**: add a mission, add another, reorder them,
   remove one. Each item is a workout plus its time cap, chosen with the
   controls that already exist.
2. Between every pair, the app shows the **rest it will apply**. There is no
   control to change it — see "Why there is no custom rest" below.
3. On Launch, mission 1 opens as normal.
4. When mission 1 finishes, mission 2 is created immediately and everyone lands
   in its rally point with the rest **already counting down**.
5. The host can **skip the rest** and start early. They cannot lengthen it,
   shorten it, or type their own number.

---

## The rest recommendation

### What the evidence actually supports

This is the part worth reading carefully, because it is the part most likely to
be quietly wrong.

Two timescales are well established and they point in opposite directions:

- **Phosphocreatine comes back fast.** Resynthesis is biphasic, with a fast
  component half-time around 21–30 seconds and a slow component beyond 170
  seconds. Most of the phosphagen system is restored within three to five
  minutes.
- **Lactate does not.** Blood lactate needs roughly 30 minutes to clear after
  maximal exercise even under the best active-recovery intensity, which is
  around 80% of the lactate threshold. No rest anyone will sit through between
  two missions in one session clears it.

The interval-training literature recommends 1:1 to 1:2 work-to-rest for
high-intensity work. Applied honestly to a 20-minute AMRAP that is a 20-minute
rest, which nobody in a social session will take, and which the existing rally
point countdown cannot even express (`set_rally_point_countdown` refuses more
than 600 seconds).

So the numbers below are **a coaching compromise between a mechanism and a
product**, not a validated prescription. They are long enough to restore the
phosphagen system that the opening of the next mission draws on, and short
enough that a squad stays together. They are explicitly too short to clear
lactate, and the UI should say so rather than implying recovery it does not
deliver.

**This is the same honesty problem as the PVI bands**, and it gets the same
treatment: publish the number, publish what justifies it, and publish what it is
not.

### Evidence status — read before citing this anywhere

The two timescales above come from **search-result summaries, not full-text
reads**: the network egress in the authoring environment blocked pubmed, PMC,
MDPI, Frontiers and doi.org at the time of writing. Every entry currently in
`src/lib/seo/scienceReferences.ts` was verified against its full text, and these
are not yet at that bar.

**Nothing from this section goes on a `/science` page, and no reference is added
to `scienceReferences.ts`, until the papers are read in full.** Until then the
recommendation is presented in-product as a coaching default, which is what it
is. Candidate sources to verify:

| Claim                                                                                   | Candidate source                                                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| PCr resynthesis biphasic, fast half-time ~21–30 s                                       | Harris et al. 1976, _Pflügers Archiv_, quadriceps PCr time course; Forbes et al. 2009, _Am J Physiol Regul_ |
| Lactate needs ~30 min, active recovery beats passive, optimum ~80% of lactate threshold | Menzies et al. 2010, _J Sports Sci_; Devlin et al. 2014                                                     |
| HIFT markers still disturbed at 15 min of recovery                                      | Mate-Muñoz et al. 2022, _IJERPH_ 19(14):8864                                                                |
| Jump performance depressed after a 20-min AMRAP                                         | `mateMunoz2017` — **already verified and in the repo**                                                      |

The last row is the only one usable today, and it supports the direction (a hard
AMRAP leaves you measurably worse off for a while) rather than any specific
number.

### The table

Rest is a function of the mission just completed — its time cap and its
intensity tier.

| Domain just run       | Base rest | Work:rest |
| --------------------- | --------- | --------- |
| Ultra-Short (3–5 min) | 90 s      | ~3:1      |
| Short (7–10 min)      | 150 s     | ~4:1      |
| Moderate (12–15 min)  | 210 s     | ~4:1      |
| Long (18–25 min)      | 300 s     | ~4:1      |

Then, by the completed mission's `intensity_tier`:

- Tier 4–5: **+60 s**
- Tier 1–2: **−30 s**
- Tier 3: unchanged

A Long mission is best left until last, and the table is why: the most rest it
can buy is six minutes against a lactate clearance measured in tens of minutes.
`chainAdvisories` says so in the builder. It is an advisory rather than a
refusal — a host who wants a Long mission mid-chain is making their own call
about their own session.

Clamped to `[60, 600]`. The upper bound is not arbitrary — it is the hard limit
`set_rally_point_countdown` already enforces, so every value this function can
return is expressible by the timer that will carry it. Longest possible rest is
360 s, comfortably inside it, so **no RPC limit needs raising**.

### Derived, never stored

`campaign_occurrences` stores a template id and nothing about what the mission is
_for_, and roles are recovered from the schedule. The same rule applies here:
the queue stores what to run, and `restBeforeSec()` derives the rest from the
previous item. The inputs — cap and tier — are already in the queue row, so the
answer is fully determined and cannot drift from a stored number that was written
under an older version of the table.

`src/lib/mission/chainRest.ts`, pure, unit tested against every legal cap.

### Why there is no custom rest

Because a rest control is a rest argument. The moment the number is editable it
becomes the thing the host fiddles with instead of the thing that keeps the
squad training together, and the honest answer to "how long should I rest" is
one the product is better placed to give than a host mid-session with a phone in
their hand. Skip is the escape hatch, and it is enough.

---

## How the rest is delivered

No new timer. `missions.rally_point_countdown_ends_at` already exists, the rally
point already renders `T-MINUS mm:ss` from it, and `ArmedRallyPointControls`
already gives the host abort and override once it is armed. A chained mission is
created with that column pre-set to `now() + rest`.

That means:

| Need                         | Existing piece                                             |
| ---------------------------- | ---------------------------------------------------------- |
| Count the rest down          | `remainingRallyPointCountdownSec`, `formatTMinus`          |
| Show it to everyone          | The rally point waiting room, unchanged                    |
| Let the host skip it         | `cancel_rally_point_countdown` — already the abort control |
| Handle T-0 with no Start yet | `formatPlusElapsed`, already shipped                       |

**The mission still does not auto-start at T-0.** That invariant is in
`CLAUDE.md` and this feature does not get to break it: at T-0 the host presses
Start, exactly as they do today. The rest is therefore a floor with a skip, not
a gate — which matches "the host can abort and start right away".

---

## Data model

One table:

```
mission_chain_items
  id                uuid pk
  rally_point_id    uuid not null references rally_points on delete cascade
  position          int  not null            -- 0-based, unique per rally point
  template_id       text null
  duration_minutes  int  not null            -- the cap, per the range table
  intensity_tier    int  null
  workout           jsonb not null
  started_mission_id uuid null               -- set when this item is launched
  created_at        timestamptz not null default now()
  unique (rally_point_id, position)
```

`started_mission_id` rather than a boolean, so the chain is an auditable record
of what actually ran rather than a checklist that forgets.

New RPCs:

- `set_mission_chain(p_rally_point_id, p_items jsonb)` — replaces the whole
  queue in one transaction. Host only. Simpler than per-row edits and matches
  how the builder works (edit locally, save once).
- `start_next_chained_mission(p_rally_point_id)` — takes the lowest unstarted
  position, creates the mission the way `start_next_rally_point_mission` already
  does, and arms `rally_point_countdown_ends_at` to `now() + rest` in the same
  transaction. Wraps rather than replaces the existing RPC.

---

## Coupling points that need a decision

### 1. Chains need a signed-in host

`start_next_rally_point_mission` resolves `auth.uid()` and rally points are
owned by a user. Guests can create a single mission today; they will not be able
to build a chain. That is a real narrowing of the create flow for the least
committed visitor, and it should be a deliberate choice rather than something
discovered in review.

**Recommendation:** accept it for v1, and have the builder say so — "Sign in to
chain missions" — rather than failing at Launch.

### 2. What happens when the host abandons mid-chain

Pass Command already moves host duties. If nobody takes it, the queue simply
stops: unstarted items keep `started_mission_id = null` and the rally point
closes as it does today.

**Recommendation:** no new behaviour. A chain is a plan, not a contract.

### 3. Chain length

**Recommendation:** cap at 5. Long enough for a real session, short enough that
the builder needs no pagination or scroll management.

`HOST_ACTIVE_MISSION_LIMIT` is 3, and `host_active_mission_count()` counts
missions in `waiting`, `setup` or `work`. **A chain does not trip it**, because
it materialises one mission at a time — mission N is `finished` before N+1 is
created — so a chain of any length holds at most one active mission of its own.
Checked rather than assumed; the limit behaves for a chain exactly as it does
for a single mission today.

### 4. Reordering changes the rest

Rest is derived from the _previous_ item, so moving an item changes the rest
before the one after it. The builder must recompute on every reorder and show
it — a stale "3:30" sitting under a row the host just moved is the kind of small
wrongness that makes people distrust the whole feature.

### 5. Changing a cap mid-chain

Phase 2 of the time-caps work lets the host move a mission's clock inside its
domain. That changes the rest after it. Same recomputation path as reordering.

---

## Phased delivery

### Phase 1 — Rest logic — **done**

`chainRest.ts` and its tests. No schema, no UI. The number is the part most
likely to be argued with, so it lands alone and reviewable.

Also carries `chainAdvisories`, which flags a Long mission that is not last —
approved as an advisory the builder surfaces, not a rule that refuses the chain.

### Phase 2 — Schema and RPCs — **done**

`mission_chain_items`, `set_mission_chain`, `get_mission_chain` (added — the
table is revoked, so the builder needs a way in) and `start_next_chained_mission`.

`start_next_chained_mission` **wraps** `start_next_rally_point_mission` rather
than reimplementing it, so the host check, the active-mission limit and the
participant seeding stay in one place. The nested call runs in the same
transaction and sees the same `auth.uid()`.

The rest table now exists twice — `chainRest.ts` for the builder's preview, and
`chain_rest_seconds` in SQL because that is what arms the countdown inside the
transaction. That is the duplication this codebase has already paid for once, so
`chainRest.contract.test.ts` parses the numbers out of the migration and runs
both implementations over every cap and tier the product can produce. Editing
either side alone fails CI with the exact input that diverged; verified in both
directions. It also pins `MAX_CHAIN_LENGTH` against the table's `CHECK` and the
RPC's own guard.

The armed rest is asserted against `isPlausibleRallyPointCountdownEndsAt` for
every legal rest, so a chained countdown cannot be silently discarded as a stray
far-future value.

### Phase 3 — The builder in Create — **done**

Add / reorder / remove, with the derived rest shown between rows and recomputed
on every change. Launch with two or more library missions creates mission 1 via
`create_rally_point_mission`, then persists the queue with position 0 stamped.

### Phase 4 — Running the chain — **done**

Advance on finish, land in the next rally point with the countdown armed, and
say what is happening: "Rest — mission 2 of 4 starts when the host is ready."
Host stays on the scorecard with Continue; joiners soft-nav during finished AAR
when the active mission advances. Reactive Daisy-chain remains when the queue is
empty. Mission 1 waiting room shows a one-line plan summary.

### Non-goals (v1)

- Custom rest durations.
- Chains inside campaigns.
- Auto-starting a mission at T-0.
- Chaining coach WODs or featured missions.
- Saving a chain as a reusable template.

---

## Open questions

1. ~~**Guest hosts**~~ — resolved: accept the sign-in requirement, and say so in
   the builder rather than failing at Launch.
2. ~~**Does the rest show before Launch?**~~ — resolved: mission 1 waiting room
   shows one line (`N missions · about M min`) from `formatChainPlanSummary`.
3. ~~**`HOST_ACTIVE_MISSION_LIMIT`**~~ — resolved during drafting, see coupling
   point 3. A chain creates one mission at a time, so the limit of 3 is never
   the binding constraint.
