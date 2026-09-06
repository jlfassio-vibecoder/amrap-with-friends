# Plan: expanded time caps within each domain

**Branch:** `feature/expanded-time-caps`
**Status:** Draft for approval
**Last updated:** 2026-09-05

---

## Verdict in one paragraph

Today each time domain is a single clock length — 5, 10, 15, or 20 minutes —
and the library, campaign tracks, SEO hubs, and domain scoring weights all key
off those exact values. Athletes already experience those four as *kinds* of
AMRAP (sprint, short, moderate, long), not as sacred integers. This feature
keeps the four domains and lets the host pick a concrete minute **inside** each
domain’s range before Start. Templates, categories, and SEO stay domain-keyed;
the mission clock becomes the selected minute. That is a small UX change with a
few hard coupling points (scoring weights, PVI buy-in, ghosts, campaign
benchmarks) that must be decided before code, not discovered mid-PR.

---

## The ask

| Domain (today) | Label | Selectable minutes |
| -------------- | ----- | ------------------ |
| 5              | Ultra-Short | 3, 4, 5 |
| 10             | Short       | 7, 8, 9, 10 |
| 15             | Moderate    | 12, 13, 14, 15 |
| 20             | Long        | 18 … 25 (see open question on `25+`) |

UI shape: keep the existing domain chips (still “the 5 / 10 / 15 / 20 family”),
then add a **time-cap selector** that only offers minutes in that domain’s
range. Default the selector to the domain’s current canonical minute (5, 10, 15,
20) so today’s behaviour is the zero-friction path.

Emoji / marketing labels (⚡🔥⚖️🫀) are optional chrome for create-mission and
content pages; buttons athletes must understand should still say the range in
plain English (“3–5 min”, “Ultra-short”) per the vocabulary rule.

---

## Current model (what we are changing)

Two layers already exist:

| Layer | Today |
| ----- | ----- |
| **Product / library** | `TimeDomain = 5 \| 10 \| 15 \| 20` via `TIME_DOMAINS`. Every template has one exact `durationMinutes`. Categories gate on those four. |
| **Runtime / DB** | `missions.duration_minutes` (and siblings) are free ints in **1–60**. The clock is `duration_minutes * 60`. Featured / coach WODs already ignore `TimeDomain` and store whatever minute the coach set. |

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
Long        → domain 20 → caps [18, 19, …, 25]     default 20
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

### 1. Domain weight (`getDomainWeight`)

Today only exact 5 / 10 / 15 / 20 get 1.0 / 1.2 / 1.5 / 1.8; **anything else
silently gets 1.0**. A 7-minute Short mission would under-weight vs a 10-minute
one if we ship the selector without updating this.

**Recommendation:** weight by **domain**, not by exact minute — e.g. any cap in
the Short range uses 1.2. Same stimulus family, fairer leaderboard within a
domain. Document that a 7-minute and a 10-minute score are still not
cross-comparable as “the same test.”

### 2. PVI buy-in exclusion (`shouldExcludeBuyInRound`)

Today: exclude round 1 when `durationMinutes >= 10`. A Short-domain 7- or
9-minute mission would currently **include** round 1; a 10-minute Short
excludes it. That is inconsistent inside one domain.

**Recommendation:** exclude buy-in for Short / Moderate / Long domains (all
caps ≥ 7 in the new table), keep Ultra-Short inclusive of round 1. Equivalent
rule: `domain !== 5` or `cap >= 7`, expressed via domain helper so it cannot
drift from the range table.

### 3. Campaign tracks and benchmarks

Tracks and frozen fingerprints key off exact minutes (`"15:localized-trap"` →
`the-equalizer`). Expanding caps must **not** edit benchmark template durations
in place.

**Recommendation (v1):** campaigns stay on **canonical** domain minutes only
(5 / 10 / 15 / 20). The expanded selector is for free missions, custom, and
rally daisy-chains. Revisit campaign “run the retest at 12 minutes” only after
benchmark identity is domain-based, not minute-based — that is a separate,
higher-risk epic.

### 4. Ghosts and exact-duration matching

Ghosts match `template_id` **and** exact `duration_minutes`. A 10-minute ghost
should not silently appear on a 7-minute run of the same template.

**Recommendation:** keep exact match. Empty ghost lane when the cap differs is
correct.

### 5. SEO and content URLs

Keep `/amrap-workouts/5-minute/`, `/10-minute/`, etc. as **domain hubs** (the
canonical library length). Do not mint `/amrap-workouts/7-minute/` in v1. Hub
copy can mention “usually run at 7–10 minutes” once the feature ships. Workout
detail pages still describe the template’s programmed minute; optional note
that hosts can shorten/lengthen within the domain.

### 6. DB check constraints

Missions allow 1–60 already; Long at 25 fits. If `25+` means above 25, still
fine up to 60 — but product copy and the selector need a hard max.

### 7. HUD / coach telemetry

SQL and client buckets that `= 5/10/15/20` should roll into domain ranges when
reporting “time domain mix,” or Short-domain 7-minute missions vanish from
charts. Follow-up task once the selector ships; acceptable to note as known gap
for a day-one patch.

---

## Phased delivery

### Phase 0 — Spec lock (this doc)

- Approve ranges, labels, and the open questions below.
- Agree domain-weight and buy-in rules.
- Agree campaigns stay canonical-only in v1.

### Phase 1 — Domain/cap helpers + scoring

- Add `timeDomains.ts` (ranges, defaults, `domainForCap` / `capsForDomain`).
- Update `getDomainWeight` and `shouldExcludeBuyInRound` to use domain
  membership; expand unit tests for every new legal cap.
- No UI yet — scoring ready before anyone can pick 7 minutes in production.

### Phase 2 — Create mission + Rally Point UI

- Domain chips unchanged in meaning; add in-range minute selector.
- Summary panel and rally duration control use the helper, not a hard-coded
  `[5,10,15,20]` list.
- Template selection: default cap = template minute; clamp adjustments to that
  domain.
- Copy: plain-English range on the control (“Time cap”, options `7 min` …).

### Phase 3 — Polish and secondary surfaces

- My missions / cards show the actual cap (“7 min”), not only the domain.
- Coach analytics domain buckets (if cheap).
- Content/SEO one-line updates on duration hub pages.
- Guided ignition / any hard-coded duration tips.

### Explicit non-goals (v1)

- New templates for every minute in the range.
- Campaign / benchmark duration flexibility.
- Renaming URL segments away from `5-minute` / `10-minute`.
- Changing fingerprint or benchmark template ids.

---

## Open questions

1. **Long `25+`:** Cap the selector at 25, or allow 26–30 (or up to 60) under
   Long? Recommendation: **hard max 25 in v1**; revisit “marathon+” later.
2. **Gaps between ranges** (6, 11, 16, 17 minutes): intentionally unavailable,
   or a fifth “custom” path? Recommendation: **unavailable** — forces a clear
   domain choice; coach WODs remain the escape hatch.
3. **Emoji on chips:** ship with labels only, or pair emoji + range text?
   Recommendation: range text required; emoji optional and never alone.
4. **Rename `TimeDomain` type** to something like `TimeDomainCanonical` vs
   `MissionTimeCap`? Nice for readability; not required for Phase 1 if helpers
   are clear.
5. **Library workouts at non-canonical caps:** allowed (same movements, shorter
   clock) or locked to template minute? Recommendation: **allowed within
   domain** — that is the point of the feature for programmed WODs too.

---

## Success criteria

- Host on Create mission / Next Mission can pick any minute in the four ranges;
  default remains 5 / 10 / 15 / 20.
- A 7-minute Short mission gets Short domain weight and Short buy-in behaviour,
  not the silent `domainWeight = 1.0` path.
- Campaigns and SEO URLs unchanged in v1.
- Ghosts only appear for the exact cap run.
- Tests cover every legal cap for weight + buy-in; create-mission UI tests cover
  range clamping when domain changes.

---

## Key files (implementation map)

| Area | Paths |
| ---- | ----- |
| Domain constants | `src/data/workoutTemplates.ts` (`TIME_DOMAINS`, `TimeDomain`) |
| New helpers | `src/lib/timeDomains.ts` (proposed) + `.test.ts` |
| Scoring | `src/lib/scoring/getDomainWeight.ts`, `getPacingDurations.ts`, `computeScoreBreakdown.ts` |
| Create / rally UI | `WorkoutTemplatePicker.tsx`, `CreateMissionSummaryPanel.tsx`, `CreateMissionPage.tsx`, `RallyPointPage.tsx` |
| Campaigns (leave canonical) | `campaignBenchmarks.ts`, `CampaignTrackPicker.tsx` |
| SEO (copy only in v1) | `src/lib/seo/contentPages.ts`, `site/pages/amrap-workouts/[duration].astro` |

---

## Suggested first PR

Phase 1 only: helpers + scoring tests, no user-visible selector. Phase 2 is the
user-facing PR once weights and buy-in are safe. That split keeps a bad default
weight from shipping under a pretty control.
