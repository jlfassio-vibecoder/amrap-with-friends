# Plan: benchmarks an athlete designates for themselves

**Branch:** `feature/personal-benchmarks` (proposed)
**Status:** Phase 1 shipped. Phases 2–4 open.
**Last updated:** 2026-09-09

---

## The three answers up front

| Question                    | Answer                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **How many at once?**       | **3 active, at most one per time domain.** Retired ones keep their history and do not count.                         |
| **When is a retest due?**   | **≥28 days AND ≥8 missions since the last attempt**, whichever lands later. Plus a readiness check, not a hard gate. |
| **What does the HUD show?** | A three-row **Benchmarks** card: the score sequence, the change, and when the next test is due. **No chart.**        |

The rest of this document is why, and the one problem that has to be solved
before any of it is built.

---

## The blocker: "Benchmark" is already taken

`CLAUDE.md` says:

> **Benchmark** | A campaign's opening mission. Its score is the number the
> campaign is measured against.

and

> **Benchmark, retest and easy day are the only mission badges.**

So the product already ships a **Benchmark** pill. It means something specific:
_the campaign chose this workout for you, from a fixed per-track table, and the
campaign will schedule the retest._ A personal benchmark means _you chose this
workout, and you decide when to run it again._

Shipping a second **Benchmark** pill with different rules breaks the rule that
governs this vocabulary — a word on something you click has to decode with zero
effort — and it breaks it in the most expensive place, because the two look
identical and behave differently.

**Three ways out, and the one to take:**

- **(a) Two meanings, one word.** Rejected. This is exactly the lobby/staging
  problem the vocabulary work already paid off once.
- **(b) Rename the personal one** — "Personal best test", "Marker", "Yardstick".
  Cheap, and worse: it makes the athlete learn two words for one idea, and the
  idea genuinely is one idea.
- **(c) One concept, one badge, two ways to acquire it.** ✅

Take **(c)**. To the athlete, both mean the same sentence: _this is the workout
I measure myself against, and I will do it again._ The difference is only who
chose it and who schedules the retest, and that difference belongs in the row's
subtitle, not in a second noun.

**What (c) does not mean.** It does not mean touching campaign internals. A
campaign's roles stay derived from the schedule by `deriveCampaignRoles`, the ids
in `campaignBenchmarks.ts` stay frozen, and `benchmarkFingerprints.ts` keeps
failing CI if a benchmark workout changes. A campaign benchmark is _rendered
through_ the same component and _counted in_ the same HUD card; it is not
re-implemented.

### Stored, not derived — and why that is not a contradiction

`CLAUDE.md` is emphatic that campaign roles are derived, never stored. That rule
exists because the schedule already encodes the role: the benchmark is the only
workout kept out of the build rotation, so the role can always be recovered and
can never drift from what is actually scheduled.

A personal designation has no schedule to read it out of. Nothing but the
athlete's intent distinguishes "I am testing myself on this" from "I did this
workout." **That intent has to be stored, and storing it is the correct call
here for the same reason deriving is correct there:** put the fact where it
actually lives.

---

## How many at once: 3, one per domain

### Why a cap exists at all

A benchmark costs training. Every retest is a mission spent measuring instead of
building, and it should be run fresh, which costs the day before it too. With
_N_ benchmarks on a ~4-week cycle and an athlete training 3× a week, testing
eats `N/12` of their training. At N=3 that is a quarter of everything they do.

### Why 3

`MAX_CAMPAIGN_TESTS = 3`. The product already has an opinion about how many
tests can be in flight, and it should not acquire a second one. Three is also
the point where the HUD card is still readable at a glance — the whole purpose
of the card is that you can see all your benchmarks without scrolling.

### Why one per time domain

`TimeDomain` is `5 | 10 | 15 | 20`, and those are different adaptations: a
5-minute test and a 20-minute test measure different systems. Three benchmarks
all at 10 minutes are three correlated numbers dressed up as three signals.

Forcing one per domain makes the cap mean something: **at most three, and they
must be genuinely different tests.** It also makes the "which should I drop?"
conversation trivial, because a new 10-minute benchmark can only replace the old
10-minute one.

The domain is `domainForCap(cap)` from `timeDomains.ts` — so a 12-minute and a
15-minute benchmark are both "15" and collide, which is right: they measure the
same thing.

### Retiring

Retiring is not deleting. A retired benchmark keeps every attempt and stays
readable in history; it just stops counting against the cap and stops asking to
be retested. **There is no un-retire and no delete** — the same reasoning as
refusing to let an athlete remove a modified mark. A benchmark you can delete
when the number goes the wrong way is not a benchmark.

---

## When is a retest due

### The rule

> **≥28 days since the last attempt, AND ≥8 missions logged since it.**

Both, whichever lands later.

**28 days** because that is roughly how long a training stimulus takes to show
up as adaptation. Testing sooner measures noise, freshness and how well you
slept, and a benchmark that moves for those reasons teaches the athlete nothing.

**8 missions** because 28 days in which you trained twice is not 28 days of
training. The product's own range is 1–5 missions a week, so 8 missions is
between 2 and 8 weeks of real work.

Together they produce the right shape without a special case:

| Athlete trains | Time gate met | Mission gate met | Retest due at |
| -------------- | ------------- | ---------------- | ------------- |
| 5× / week      | 4 weeks       | ~1.5 weeks       | **4 weeks**   |
| 3× / week      | 4 weeks       | ~2.5 weeks       | **4 weeks**   |
| 1× / week      | 4 weeks       | 8 weeks          | **8 weeks**   |

Someone training more tests more often; nobody tests before four weeks.

Any mission counts toward the 8, not only missions in that domain. General
training is what drives the adaptation, and only counting same-domain missions
would push athletes toward training the test instead of training.

### Readiness: a sentence, never a gate

The campaign machinery puts an easy day before a test so the test measures
fitness rather than fatigue. A personal benchmark cannot schedule that. What it
_can_ do is read the signal that already exists: when `evaluateOvertrainingRisk`
puts the athlete at `elevated` or `high`, the card says so —

> Your load is high this week. A test today measures fatigue as much as fitness.

— and offers nothing else. **It never blocks the retest, and it never
prescribes a rest day**, for the reason already settled in the overtraining
work: guidance has to keep people active. The athlete decides.

### The trigger is a shortcut, not a new flow

"Retest" opens Create mission with the template and time cap pre-filled and
**locked** — a retest at a different cap is not a retest — and the same-variant
ghost pre-selected. That last part is the whole reason the ghost work was worth
doing: **a benchmark retest is exactly a ghost race against your own benchmark
run**, and it needs no new pacing code.

---

## How attempts are tracked

**Attempts are derived, not stored.** An attempt is any scored
`participant_segment_results` row of the same `template_id`, the same
`duration_minutes`, and the same `movement_version_key` as the benchmark, by
that user. No attempts table, no join row, nothing to keep in step.

This falls out of work already shipped: `versionKeyFor` /
`movement_version_key` already define "the same workout performed the same way",
and are already contract-tested across TypeScript and SQL.

**The consequence, stated plainly:** a workout you ran casually counts as an
attempt. That is deliberate. The alternative is a benchmark series that
disagrees with My missions about what you scored on the same workout on the same
day, which is a worse failure than an unplanned data point. The version note and
the readiness note carry the honest caveats.

**What it does not touch.** A benchmark designation changes no score, no PVI, no
domain weight, no training load, no intensity tier and no classification
progress. Same rule as the modified-movement mark, and for the same reason: the
moment designating a benchmark moves a number, people designate for the number.

### Schema sketch

```sql
CREATE TABLE public.athlete_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  duration_minutes int NOT NULL,
  time_domain int NOT NULL,          -- domainForCap(duration_minutes)
  version_key text NOT NULL DEFAULT '',
  designated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz NULL
);

-- The cap, enforced where it cannot be raced: one live benchmark per domain,
-- three domains max is then a plain count check in the RPC.
CREATE UNIQUE INDEX athlete_benchmarks_one_active_per_domain
  ON public.athlete_benchmarks (user_id, time_domain)
  WHERE retired_at IS NULL;
```

RLS-locked and revoked like every other table; reads and writes go through
`SECURITY DEFINER` RPCs (`designate_benchmark`, `retire_benchmark`,
`my_benchmarks`). The three-at-once cap is checked inside `designate_benchmark`
in the same transaction as the insert, not in the client.

---

## The HUD card

### Form first: this is not a chart

Three series of two to five points each. A line chart of two points is a line
with no information in it, and three sparklines of four points cost more
attention than they return. **The numbers are the clearest form**, which is the
same conclusion the modification and RPE progression panels reached.

```
BENCHMARKS                                            2 of 3 active

The Hull Breach · 5 min
142 → 156 reps        +14 (+9.9%)          Retest due

The Pacer · 20 min
310 reps              first attempt        Retest in 11 days
```

Row by row:

- **Workout · cap.** The identity of the test. Never abbreviated.
- **The sequence.** Oldest to newest, the way it happened.
- **The change.** Absolute _and_ percent. Percent is the headline here in a way
  it is not elsewhere: +14 reps means nothing without knowing whether the score
  was 40 or 400.
- **Status.** `Retest due` / `Retest in 11 days` / `Retest in 5 missions` —
  naming whichever gate is actually binding, so the athlete knows what to do
  about it.

### What the card must not claim

- **Two points are not a trend.** The first retest yields one delta and the card
  says `+14 (+9.9%)`, not "improving". A trajectory needs a third point, and
  until there is one the card must not draw one.
- **A version change is disclosed.** If the attempts were not all performed the
  same way, the row says so — the same sentence the RPE panel uses, for the same
  reason. Moving from knee push-ups to full ones and scoring lower is progress
  reported as a loss unless the card says what changed.
- **No projection, no goal line, no "on track".** There is no validated model
  for how fast a benchmark should move, and inventing one would be inventing a
  number, which this product has repeatedly declined to do.
- **Nothing about other athletes.** A benchmark is a comparison with yourself.

### Where it goes

Below the classification and overtraining cards, above the domain matrix. It is
a progress surface, not an alert, and it must not compete with the overtraining
card for attention.

The card renders nothing at all until the athlete has designated one — no empty
state selling the feature. Designating happens where the decision is made: on
the mission, before running it.

---

## Delivery

**Phase 1 — designate and badge. ✅ Shipped.** Table, RPCs, the control on the
rally point before start, the pill and Retire on My missions, and the pure cap
rules in `src/lib/benchmark/`. Designation on the Create form was dropped from
scope — see "Where designation happens" below.

**Phase 2 — attempts and retest.** Derive attempts by version key, the due
calculation, the Retest shortcut with template and cap locked and the ghost
pre-selected.

**Phase 3 — the HUD card.** The three rows, the version note, the readiness
note.

**Phase 4 — unify the campaign badge.** Render the campaign's derived benchmark
through the same row component, and count a campaign benchmark in the card.
Deliberately last: it is the only phase that touches shipped campaign surfaces,
and it is worth nothing until phases 1–3 exist.

### Settled

1. **A campaign benchmark occupies one of the three.** Decided. An athlete in a
   campaign has two personal slots, and the UI names the campaign holding the
   third rather than leaving them to wonder where it went.
2. **Library templates only.** Decided. A coach can edit their own workout
   underneath a stored benchmark, and nothing fingerprints a coach workout the
   way `benchmarkFingerprints.ts` covers the campaign benchmarks. Refused in the
   RPC and in `isBenchmarkableTemplate`.

---

## Phase 1, as shipped

`athlete_benchmarks`, the three RPCs, the designate control on the rally point,
and the pill on My missions. No HUD, no attempts, no retest — those are phases 2
and 3.

### Where the cap is enforced, and why in two places

The database enforces what must hold whatever the client does: **one personal
benchmark per domain** (a partial unique index, not just a check — two
concurrent designates both pass a SELECT-then-INSERT), **three personal at
most**, and **library templates only**.

It deliberately does not know about campaign benchmarks. `deriveCampaignRoles`
is not "the first occurrence": it also requires the schedule to end by repeating
its opening workout, and bails when there are more repeats than any campaign
length schedules. A second copy of that in plpgsql would drift the first time
either changed — and drift silently, since the only symptom is a cap that admits
one benchmark too many. So `my_campaigns` now ships the raw ordered schedule and
`campaignBenchmarkSlots.ts` decides, using the same function the campaign detail
page uses.

**Over-designating costs the athlete training, not integrity.** That is the
right thing to enforce in the cheaper place. `benchmarkCap.contract.test.ts`
pins the numbers the two halves do share — the limit, the four domains, the legal
clocks, the coach-workout refusal, the unique index and the grants.

### Where designation happens

On the rally point, before start — not on the Create form. By then the workout
and the clock are settled and the athlete's modification plan is on the same
screen, so the version the benchmark records is the version they are about to
perform. Asking on Create would be asking before any of that is known.

It is personal, not per mission: a joiner designates for themselves, and the
host does not designate for the squad.

### The badge covers runs from before the designation

`benchmarkForMission` matches on workout and clock, so every run of a benchmark
workout wears the pill, including ones from before it was designated. Same call
the attempt derivation makes: what you scored on that workout at that clock is
the measurement, whether or not a button was pressed first.
