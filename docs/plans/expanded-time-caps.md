# Plan: expanded time caps within each domain

**Branch:** `feature/expanded-time-caps`
**Status:** Phase 1 shipped — Phase 2 (the selector UI) is next
**Last updated:** 2026-09-06

---

## Verdict in one paragraph

Today each time domain is a single clock length — 5, 10, 15, or 20 minutes —
and the library, campaign tracks, SEO hubs, and domain scoring weights all key
off those exact values. Athletes already experience those four as _kinds_ of
AMRAP (sprint, short, moderate, long), not as sacred integers. This feature
keeps the four domains and lets the host pick a concrete minute **inside** each
domain’s range before Start. Templates, categories, and SEO stay domain-keyed;
the mission clock becomes the selected minute. That is a small UX change with a
few hard coupling points — scoring weights, PVI buy-in, ghosts, campaign
benchmarks, and one blocker the first draft missed: the Special Ops
classification is gated on an exact 20-minute mission. Those must be decided
before code, not discovered mid-PR.

---

## The ask

| Domain (today) | Label       | Selectable minutes             |
| -------------- | ----------- | ------------------------------ |
| 5              | Ultra-Short | 3, 4, 5                        |
| 10             | Short       | 7, 8, 9, 10                    |
| 15             | Moderate    | 12, 13, 14, 15                 |
| 20             | Long        | 18 … 25 (hard max 25 — see D1) |

UI shape: keep the existing domain chips (still “the 5 / 10 / 15 / 20 family”)
looking exactly as they do today, then add a **time-cap selector** beneath them
that only offers minutes in that domain’s range. The selector is secondary and
collapsed — it reads the canonical minute (5, 10, 15, 20) until it is touched,
so today’s behaviour is the zero-friction path and the four times stay the ones
the product is about. It is not a second row of chips.

Emoji / marketing labels (⚡🔥⚖️🫀) are optional chrome for create-mission and
content pages; buttons athletes must understand should still say the range in
plain English (“3–5 min”, “Ultra-short”) per the vocabulary rule.

---

## Current model (what we are changing)

Two layers already exist:

| Layer                 | Today                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Product / library** | `TimeDomain = 5 \| 10 \| 15 \| 20` via `TIME_DOMAINS`. Every template has one exact `durationMinutes`. Categories gate on those four.                                                                  |
| **Runtime / DB**      | `missions.duration_minutes` (and siblings) are free ints in **1–60**. The clock is `duration_minutes * 60`. Featured / coach WODs already ignore `TimeDomain` and store whatever minute the coach set. |

So the database is not the blocker. The discrete product model is: create-mission
chips, template filters, `getDomainWeight`, campaign track keys
(`"10:blood-shunt"`), SEO `/amrap-workouts/10-minute/…`, HUD telemetry buckets,
and ghost matching on exact `(template_id, duration_minutes)`.

---

## Proposed model

### Domain vs clock

Introduce an explicit split that the code already almost has:

- **Domain** — which library bucket / category matrix / SEO hub / campaign track
  family. Still the four values `5 | 10 | 15 | 20` (or a renamed id later; see
  open questions). Templates keep `durationMinutes` as their **canonical
  domain** for filtering and content URLs.
- **Time cap** — the mission’s actual work length in minutes, chosen from the
  domain’s allowed set when creating or daisy-chaining a mission.

`create_mission` / rally RPCs already take `p_duration_minutes`. Persist the
**selected cap**, not only the domain. When a template is chosen, default the
cap to the template’s `durationMinutes`, then let the host nudge within range
(or lock to template if we decide library workouts must stay canonical — see
phasing).

### Mapping table (source of truth)

Put this in one module under `src/lib/` (e.g. `timeDomains.ts`) and import
everywhere — do not scatter literal ranges in components.

```ts
// Sketch — names TBD in implementation
Ultra-Short → domain 5  → caps [3, 4, 5]           default 5
Short       → domain 10 → caps [7, 8, 9, 10]       default 10
Moderate    → domain 15 → caps [12, 13, 14, 15]    default 15
Long        → domain 20 → caps [18, 19, …, 25]     default 20  (hard max 25)
```

Helpers: `capsForDomain(domain)`, `domainForCap(minutes)`, `isCapInDomain(cap, domain)`,
`defaultCapForDomain(domain)`.

---

## Where the selector appears

1. **Create mission** — after domain chip (and when no template locks the clock,
   or always as an override within range). Summary panel today uses
   `DURATION_OPTIONS = [5, 10, 15, 20]`; replace with domain chip + in-range
   minute control.
2. **Next Mission / Rally Point** — same control when the host sets the next
   workout’s clock (`RallyPointPage` already has a duration control).
3. **Custom (no template)** — domain first, then cap inside the range.
4. **Template selected** — recommended default: prefill cap to the template’s
   minute; allow adjust within the template’s domain only (so a 10-minute
   Blood Shunt cannot become a 15-minute mission without changing domain /
   template).
5. **Coach / featured WODs** — already free-form; optionally clamp or warn when
   outside the four ranges, but do not break existing 6- or 30-minute coach
   WODs in v1.

Out of scope for v1: changing every library template into multiple duration
variants, or generating new SEO pages per minute (3-minute, 7-minute, …).

---

## Coupling points that need a decision

### 1. Classification gate on an exact 20-minute mission — blocker

`supabase/migrations/20260902090000_hud_telemetry_activity_7d.sql` counts the
Special Ops prerequisite as `count(*) FILTER (WHERE s.duration_minutes = 20)`
(lines 118 and 152), and line 171 makes `v_marathon_20 >= 1` a hard requirement
for the rank. Ship the selector without touching this and an athlete who runs an
18-, 22- or 25-minute Long mission earns **no credit toward Special Ops**, with
no explanation anywhere in the UI.

This is not the same class of problem as the load-imbalance nag below. The nag
is cosmetic; this is the reward ladder the OPERATOR identity is built on, and it
fails silently in the direction of taking something away from the athlete.

**Decision: Phase 1, in SQL, shipped with the selector — not after it.** The
filter becomes Long-domain membership (`duration_minutes >= 18`), matching the
range table rather than the canonical minute.

### 2. Domain weight (`getDomainWeight`)

Today only exact 5 / 10 / 15 / 20 get 1.0 / 1.2 / 1.5 / 1.8; **anything else
silently gets 1.0**. A 7-minute Short mission would under-weight vs a 10-minute
one if we ship the selector without updating this.

The obvious fix — weight by domain, so any cap in the Short range gets 1.2 — has
a defect that only appears once the in-between minutes are selectable. It puts a
cliff at every range boundary, and the selector walks the athlete up to the edge
of it:

| Move                           | Extra clock | Extra weight under bucketing |
| ------------------------------ | ----------- | ---------------------------- |
| 7 → 10 min (within Short)      | +43%        | +0%                          |
| 10 → 12 min (Short → Moderate) | +20%        | +25%                         |

Two minutes across a boundary buy roughly 20% more reps _and_ a 25% multiplier
bump — about +50% final score — while three minutes inside a range buy nothing.
That cliff exists in today's code too, but it is unreachable: the only
selectable minutes are the anchors themselves.

**Decision: interpolate the weight by minute instead of bucketing it.**
Piecewise-linear through the existing anchors (5 → 1.0, 10 → 1.2, 15 → 1.5,
20 → 1.8), extended at both ends with the adjacent slope:

| Cap    | 3    | 4    | 5    | 7    | 8    | 9    | 10   | 12   | 13   | 14   | 15   | 18   | 19   | 20   | 21   | 22   | 23   | 24   | 25   |
| ------ | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Weight | 0.92 | 0.96 | 1.00 | 1.08 | 1.12 | 1.16 | 1.20 | 1.32 | 1.38 | 1.44 | 1.50 | 1.68 | 1.74 | 1.80 | 1.86 | 1.92 | 1.98 | 2.04 | 2.10 |

Why this and not bucketing:

- **Exactly backwards compatible at 5 / 10 / 15 / 20**, so no stored
  `score_breakdown` jsonb changes meaning. (Scoring is client-side and persisted
  as jsonb — there is no server-side recompute to worry about.)
- **No silent 1.0 fallback** for any minute, in range or not.
- **No minute is arbitrage**: weight rises monotonically and smoothly with the
  clock, so there is no boundary to farm.
- **Less code than a range table** for this particular concern.

If 2.10 at the top of Long reads as too much ladder, the alternative is to clamp
above 20 — but that puts a flat spot back at the top of the range, which is the
same defect in a smaller place. Prefer the extension.

### 3. PVI buy-in exclusion — two implementations, not one

The rule is written twice and only one of them goes through the helper:

| Where                                         | Form                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/scoring/getPacingDurations.ts:6`     | `shouldExcludeBuyInRound(durationMinutes)`, used by `PacingBarChart.tsx` |
| `src/lib/scoring/computeScoreBreakdown.ts:25` | hard-coded `excludeFirstRound: durationMinutes >= 10`                    |

Update only the helper and a 7-minute mission renders a splits chart with round
1 greyed out **next to a score that counted it**.

On the rule itself: today's `>= 10` would include round 1 on a 7- or 9-minute
Short mission and exclude it on a 10-minute one — inconsistent inside one
domain.

**Decision:** exclude buy-in for Short / Moderate / Long, keep Ultra-Short
inclusive of round 1 (equivalently `domain !== 5`, or `cap >= 7`), expressed via
the domain helper so it cannot drift from the range table. Buy-in is a boolean,
so bucketing is the only option here and it is the right one.

**Sequencing:** Phase 1's first commit collapses the `computeScoreBreakdown`
literal into `shouldExcludeBuyInRound` as a pure no-op refactor, with the
existing tests green and unchanged. Only the commit after that changes the rule.

### 4. The buy-in rule is published copy

Two shipped pages state the current rule in prose:

- `site/pages/science/pacing.astro:171` — "On missions of ten minutes or longer
  the first round is excluded"
- `site/pages/guides/amrap-pacing.astro:79` — same sentence

Change the rule to `cap >= 7` and both are wrong the day it ships. The PVI
calculator island on `/science/pacing` also offers a hard-coded
`[5, 10, 15, 20]` cap selector that should read the range table.

**Decision:** the copy edits land in the same PR as the rule change, not in
Phase 3. A science page that misstates the product is worse than one that says
nothing.

### 5. Campaign tracks and benchmarks

Tracks and frozen fingerprints key off exact minutes (`"15:localized-trap"` →
`the-equalizer`). Expanding caps must **not** edit benchmark template durations
in place.

**Decision (v1):** campaigns stay on **canonical** domain minutes only
(5 / 10 / 15 / 20). The expanded selector is for free missions, custom, and
rally daisy-chains. Revisit campaign "run the retest at 12 minutes" only after
benchmark identity is domain-based, not minute-based — that is a separate,
higher-risk epic.

### 6. Ghosts and exact-duration matching

Ghosts match `template_id` **and** exact `duration_minutes` — there is an index
on that pair (`20260824140000_session_template_id_and_ghost_rpcs.sql:9`). A
10-minute ghost should not silently appear on a 7-minute run of the same
template.

**Decision:** keep exact match. Empty ghost lane when the cap differs is
correct — but see the UI note in decision D5 below, because an empty lane with
no explanation reads as a bug rather than as a consequence.

### 7. SEO and content URLs

Keep `/amrap-workouts/5-minute/`, `/10-minute/`, etc. as **domain hubs** (the
canonical library length). Do not mint `/amrap-workouts/7-minute/` in v1. Hub
copy can mention "usually run at 7–10 minutes" once the feature ships. Workout
detail pages still describe the template's programmed minute; optional note
that hosts can shorten/lengthen within the domain.

### 8. DB check constraints

`missions_duration_minutes_check` is `BETWEEN 1 AND 60`, so **a hard max of 25
needs no migration**. `create_mission` validates 1–60 and is shared with coach
WODs that legitimately run 6 or 30 minutes, so **do not tighten the RPC to the
range table** — client-side range enforcement is the right and only place for
it.

### 9. HUD / coach telemetry buckets

Separate from the classification gate in decision 1: the domain-mix reporting
buckets on `duration_minutes = 5 / 10 / 15 / 20` with everything else falling
into `other`
(`20260902090000_hud_telemetry_activity_7d.sql:256-262`). A Short-domain
7-minute mission would land in `other` and vanish from the domain-mix charts,
and `evaluateLoadImbalance` would nag about a domain the athlete actually
trained.

**Decision:** roll these filters into domain ranges. Cheap once decision 1 is
already editing the same function; do it in the same migration rather than
leaving a second pass.

---

## Phased delivery

### Phase 0 — Spec lock (this doc)

- **Done.** Ranges, labels, weighting, buy-in and the five open questions are
  resolved below; campaigns stay canonical-only in v1.

### Phase 1 — Types, helpers, scoring, and the classification gate — **done**

No user-visible selector. Scoring and progression must be safe before anyone can
pick 7 minutes in production. All seven steps below shipped; the migration still
needs `npm run supabase:push`.

1. Collapse the duplicated buy-in literal in `computeScoreBreakdown.ts` into
   `shouldExcludeBuyInRound` — pure no-op refactor, existing tests unchanged.
2. Add `src/lib/timeDomains.ts`: ranges, defaults, `capsForDomain`,
   `domainForCap`, `isCapInDomain`, `defaultCapForDomain`.
3. Split the type: `TimeDomain` stays the literal union `5 | 10 | 15 | 20` for
   library / campaign / SEO keys; add `MissionTimeCap` for the mission clock.
   Change `RallyPointPage`'s `useState<TimeDomain>` to the new type and delete
   the `as TimeDomain` cast at `RallyPointPage.tsx:269`.
4. Replace `getDomainWeight`'s switch with the interpolated curve; assert the
   four canonical minutes still return 1.0 / 1.2 / 1.5 / 1.8 exactly.
5. Change the buy-in rule to domain membership.
6. Migration: Long-domain membership for `marathon_20`, and domain-range buckets
   for the domain-mix filters.
7. Update `site/pages/science/pacing.astro` and
   `site/pages/guides/amrap-pacing.astro` to state the new rule, and point the
   PVI calculator's cap selector at the range table.

### Phase 2 — Create mission + Rally Point UI

- Domain chips unchanged in appearance and meaning. The cap control is a
  secondary, collapsed row beneath them that reads the canonical minute until
  it is touched — progressive disclosure, not a second row of chips.
- Summary panel and rally duration control use the helper, not a hard-coded
  `[5,10,15,20]` list (`CreateMissionSummaryPanel.tsx:9`).
- Template selection: default cap = template minute; clamp adjustments to that
  template's domain; name the deviation in the UI ("Blood Shunt · 8 min").
- Copy: plain-English range on the control ("Time cap", options `7 min` …).
- When the chosen cap is not the template's minute, say that the ghost lane will
  be empty — one line, near the control.

### Phase 3 — Polish and secondary surfaces

- My missions / cards show the actual cap ("7 min"), not only the domain.
- Content/SEO one-line updates on duration hub pages.
- Guided ignition / any hard-coded duration tips.

### Explicit non-goals (v1)

- New templates for every minute in the range.
- Campaign / benchmark duration flexibility.
- Renaming URL segments away from `5-minute` / `10-minute`.
- Changing fingerprint or benchmark template ids.

---

## Decisions (formerly open questions)

**D1 — Long hard max.** Cap the selector at **25**. No migration: the mission
check constraint is already `BETWEEN 1 AND 60`. "Marathon+" above 25 is a later
conversation, not a v1 flag.

**D2 — Gaps at 6, 11, 16, 17 minutes.** Intentionally unavailable. The selector
only ever renders in-range minutes, so the gaps are not perceivable; coach WODs
remain the escape hatch for anything else.

**D3 — Emoji on chips.** Range text required, emoji optional and never alone,
per the vocabulary rule in `CLAUDE.md`.

**D4 — Renaming `TimeDomain`.** **Required in Phase 1**, upgraded from "nice for
readability." `TimeDomain` is a literal union that currently makes an illegal
clock unrepresentable — and `RallyPointPage.tsx:57` holds it in
`useState<TimeDomain>` while line 269 already escapes with `as TimeDomain`. Ship
Phase 2 without splitting the type and that cast multiplies until the union is
decorative. Introduce `MissionTimeCap` while nothing depends on it yet.

**D5 — Library workouts at non-canonical caps.** Allowed within the template's
own domain — that is the point of the feature for programmed WODs too. Two
conditions: the default stays the template's programmed minute, and the UI names
the deviation, because the ghost lane goes empty at a non-canonical cap
(decision 6) and an unexplained empty lane reads as a bug.

---

## Success criteria

- Host on Create mission / Next Mission can pick any minute in the four ranges;
  default remains 5 / 10 / 15 / 20 and the four chips look unchanged.
- `getDomainWeight` returns exactly 1.0 / 1.2 / 1.5 / 1.8 at 5 / 10 / 15 / 20
  after the change, and a monotonically increasing value at every legal cap —
  no silent 1.0, no boundary jump.
- The splits chart and the score agree on buy-in exclusion for every legal cap,
  because they read the same helper.
- An 18-minute Long mission counts toward Special Ops.
- No Short-domain mission lands in the telemetry `other` bucket.
- Campaigns and SEO URLs unchanged in v1.
- Ghosts only appear for the exact cap run, and the UI says so when they will
  not.
- `/science/pacing` and `/guides/amrap-pacing` state the shipped buy-in rule.
- Tests cover every legal cap for weight + buy-in; create-mission UI tests cover
  range clamping when domain changes.

---

## Key files (implementation map)

| Area                              | Paths                                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain constants                  | `src/data/workoutTemplates.ts` (`TIME_DOMAINS`, `TimeDomain`)                                                                                                                                                              |
| New helpers                       | `src/lib/timeDomains.ts` (proposed) + `.test.ts`                                                                                                                                                                           |
| Scoring                           | `src/lib/scoring/getDomainWeight.ts`, `getPacingDurations.ts`, `computeScoreBreakdown.ts` (holds the duplicated buy-in literal)                                                                                            |
| Classification + telemetry        | `supabase/migrations/20260902090000_hud_telemetry_activity_7d.sql` (`marathon_20` at :118/:152/:171, domain buckets at :256-262), `src/lib/hud/types.ts` (`HudCoreDomain`, `HudDomainMinutes`), `evaluateLoadImbalance.ts` |
| Create / rally UI                 | `WorkoutTemplatePicker.tsx`, `CreateMissionSummaryPanel.tsx` (`DURATION_OPTIONS` at :9), `CreateMissionPage.tsx`, `RallyPointPage.tsx` (:57 state type, :269 cast)                                                         |
| Campaigns (leave canonical)       | `campaignBenchmarks.ts`, `CampaignTrackPicker.tsx`                                                                                                                                                                         |
| Published copy on the buy-in rule | `site/pages/science/pacing.astro:171`, `site/pages/guides/amrap-pacing.astro:79`, `site/islands/PacingCalculator.tsx` (cap selector)                                                                                       |
| SEO (copy only in v1)             | `src/lib/seo/contentPages.ts`, `site/pages/amrap-workouts/[duration].astro`                                                                                                                                                |

---

## Suggested first PR

Phase 1 only: types, helpers, scoring, the classification migration, and the
copy corrections — no user-visible selector. Phase 2 is the user-facing PR once
weights, buy-in and progression are safe. That split keeps a bad default weight
from shipping under a pretty control, and keeps a silently unreachable rank from
shipping at all.
