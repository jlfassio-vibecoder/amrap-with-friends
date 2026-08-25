# Epic: The HUD (Heads-Up Display)

**Branch:** `feature/hud-telemetry`  
**Status:** Draft  
**Last updated:** 2026-08-24

---

## Vision

A HUD does not motivate; it informs. We are stripping away gamified, confetti-laden progress trackers. The HUD is a cold operational dashboard that exposes biological compliance, pacing discipline, and load distribution. The data is absolute.

This project already locks an immutable `score_breakdown` at session finish. The HUD is the next surface: not another chronological list of workouts, but a telemetry readout of whether the athlete paid the weekly tax — and where they hid from it.

> "The Baseline is a biological tax. You either pay it in sweat, or your body slowly degrades. The data does not care about your excuses."

---

## Current State (Baseline)

| Area | Today |
| --- | --- |
| User progress | Chronological list only: [`MySessionsPage`](src/pages/MySessionsPage.tsx) via `my_sessions()` RPC |
| Volume tracking | No aggregation of `sessions.duration_minutes` |
| Compliance | No 150-minute weekly floor |
| Telemetry | P.V.I. and domain weight exist **per session** ([`ScoreBreakdown`](src/lib/scoring/types.ts)); no trends across weeks |
| Auth surface | Signed-in header link is **My sessions** only ([`AuthHeaderActions`](src/components/AuthHeaderActions.tsx)) |
| Route | `/my-sessions` exists; no `/hud` |

This epic adds a centralized telemetry query and a brutalist UI. It does **not** replace My Sessions.

---

## Adaptation notes (this codebase, not a greenfield app)

The source HUD brief assumed a generic Edge Function and a UTC offset. This project already has patterns we must follow:

| Source brief | This project |
| --- | --- |
| `fetch-hud-telemetry` Edge Function | Prefer a **SECURITY DEFINER RPC** `hud_telemetry(p_timezone text)` — same family as [`my_sessions()`](supabase/migrations/20260824120000_participant_score_persistence.sql). Edge Functions here are for **writes that need the service role** (`submit-participant-result`). HUD is a signed-in **read**. |
| Pass timezone **offset** | Pass **IANA timezone** (`America/Los_Angeles`). Offsets break across DST. Postgres `AT TIME ZONE` with IANA names is the correct boundary. |
| Sum any created session | Count only **claimed + locked** rows: `participants.user_id = auth.uid()` **and** `participant_segment_results.score_breakdown IS NOT NULL`. Creating a lobby is not work. Guests do not appear until they save to account. |
| Domain = 5 / 10 / 15 / 20 | Matches existing [`TimeDomain`](src/data/workoutTemplates.ts) and [`getDomainWeight`](src/lib/scoring/getDomainWeight.ts). Schema allows `duration_minutes` 1–60; bucket 5/10/15/20 and put the rest in `other`. |
| Client-side aggregation of history | **Forbidden.** Do not call `fetchMySessions()` and sum on the phone. That payload includes full workout JSON and will grow without bound. |
| SPA | Vite + React Router. Add `/hud` in [`src/App.tsx`](src/App.tsx). Reuse [`NarrowPageLayout`](src/components/NarrowPageLayout.tsx) + [`AppHeader`](src/components/AppHeader.tsx). |
| Numbers | Use existing `text-display` + `tabular-nums` (same as timer and scorecard). Do not add a new typeface. |

---

## Master architecture

```
Auth user
    ↓
hud_telemetry(p_timezone)   -- Postgres RPC, auth.uid()
    ↓
HUDTelemetryPayload         -- typed JSON
    ↓
src/lib/hud/*               -- pure client helpers (clocks, imbalance, labels)
    ↓
HUDPage + child components
```

### Eligibility (immutable reliance)

A session contributes minutes **only if all** of:

1. `participants.user_id = auth.uid()` (claimed / signed-in identity)
2. Matching `participant_segment_results` row for the session's `segment_index`
3. `score_breakdown IS NOT NULL` (Phase 4 lock — same gate as Ghost RPCs)

**Clock used for week/day windows:** `participant_segment_results.updated_at` (score lock time), **not** `sessions.created_at` and **not** `participants.joined_at`. Starting a timer is not finishing the work.

**Minutes credited:** `sessions.duration_minutes` of that locked session (full programmed domain, not elapsed-so-far).

### Timezone contract

Client sends:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

Server validates against `pg_timezone_names`. Invalid / missing → `{ ok: false, reason: 'invalid_timezone' }`.

Week = **Monday 00:00:00** through **Sunday 23:59:59.999** in that zone. Sunday-night finishes must not leak into Monday.

### Payload (target type)

```ts
// src/lib/hud/types.ts

export type HudDailyStatus = 'active' | 'dormant' | 'detraining' | 'never';

export type HudDomainMinutes = {
  5: number;
  10: number;
  15: number;
  20: number;
  other: number;
};

export interface HUDTelemetryPayload {
  lastLockedAt: string | null; // ISO timestamptz of latest locked result
  weekMinutes: number;         // current local Mon–Sun
  weekPviAverage: number | null; // mean of non-null score_breakdown.pvi this week
  weekEndsAt: string;          // ISO of next Monday 00:00 local, as UTC instant
  domainMinutes30d: HudDomainMinutes;
  attrition: boolean[];        // length 12; index 0 = oldest week, 11 = current week
}
```

RPC envelope: `{ ok: true, telemetry: HUDTelemetryPayload }` or `{ ok: false, reason: string }`.  
Client wrapper: `src/lib/api/hudTelemetry.ts` mirroring [`fetchMySessions`](src/lib/api/mySessions.ts).

---

### 1. Daily telemetry (immediate state)

**Server:** `lastLockedAt`  
**Client:** `computeTimeSinceLastBurn(lastLockedAt, now)` → hours/minutes since lock.

| Condition | Status | UI |
| --- | --- | --- |
| No locked sessions | `never` | Copy: no lock on record. Gray. |
| `< 24h` | `active` | Accent (`text-accent`) |
| `≥ 24h` and `< 48h` | `dormant` | Muted / gray |
| `≥ 48h` | `detraining` | `text-error` |

Do not invent a server-side status enum for the clock; status is derived on the client so the T-minus display updates without refetch.

---

### 2. Weekly baseline (150-minute mandate)

**WHO aerobic floor, applied as a tax:** 150 minutes of **locked** session duration in the current local week.

**Server:**

- `weekMinutes` = `sum(sessions.duration_minutes)` for eligible rows whose lock timestamp falls in `[weekStart, weekEnd]`
- `weekPviAverage` = average of ` (score_breakdown->>'pvi')::numeric ` where `pvi` is not null. Insufficient-round sessions (`pvi: null`) are **excluded** from the average, not treated as 0.

**Client:**

- Horizontal brutalist bar. **Fill width** clamped at 150 / 150. **Numeric label** continues past 150 (`187 / 150`).
- Countdown to `weekEndsAt` (Sunday midnight local = Monday 00:00). Use `tabular-nums`.

P.V.I. average is a secondary readout on the same card (one number + existing classification via [`getPviMultiplier`](src/lib/scoring/getPviMultiplier.ts) if desired). Do not recompute P.V.I. from round splits on the HUD.

---

### 3. Monthly domain distribution (macro truth)

**Server:** Sum minutes for eligible locks in the rolling **30 × 24h** window ending at `now()`, grouped by `duration_minutes`.

Map:

| Minutes | Domain label (existing) |
| --- | --- |
| 5 | Sprint |
| 10 | Crucible |
| 15 | Grind |
| 20 | Marathon |
| other | Other |

**Client:** `evaluateLoadImbalance(domainTotals)` — see tests below.

**UI:** SVG segmented bar (same constraint as [`PacingBarChart`](src/components/PacingBarChart.tsx): **no chart library**). Warning text when imbalance fires.

Suggested warning copy (Architect):

- Dominant 5: *"System Warning: Imbalanced Load. 20-Minute Marathon required."*
- Dominant 10: *"System Warning: Imbalanced Load. Extend the domain. 15-Minute Grind required."*
- Dominant 15: *"System Warning: Imbalanced Load. You are hiding in the Grind. Sprint or Marathon required."*
- Dominant 20: *"System Warning: Imbalanced Load. You never touch the redline. 5-Minute Sprint required."*

`other` never triggers the 60% rule (cannot prescribe a template for arbitrary durations).

---

### 4. Attrition log (12-week consistency)

**Server:** For each of the last 12 local calendar weeks (oldest → current), `sum(duration_minutes) >= 150` → `true`.

**UI:** One row of 12 squares. Solid accent fill = compliant. Hollow `border-border` = deficient. No tooltips required in v1; `aria-label` per cell (`Week of {date}: compliant | deficient`).

---

## Phases

Each phase is **one planning slice**. Plan, implement, and ship independently where dependencies allow.

---

### Phase 1 — Telemetry RPC & weekly baseline

**Planning goal:** Server-side week sum + P.V.I. average; HUD page with the 150-minute bar and Sunday reset countdown.

#### Scope

- Migration: `hud_telemetry(p_timezone text) returns jsonb` (SECURITY DEFINER, `GRANT EXECUTE … TO authenticated`).
- Client: `HUDTelemetryPayload`, `fetchHudTelemetry(timeZone)`, `HUDPage` at `/hud`.
- UI: weekly bar + countdown. Auth gate identical to My Sessions (sign-in prompt if guest).
- Header: **HUD** link next to **My sessions** when authenticated.

#### Dependencies

- Phase 4 scoring lock (`score_breakdown`) — already on `main`.
- Claimed `participants.user_id` — already on `main`.

#### Deliverables

- [ ] SQL: week bounds in `p_timezone`; sum minutes; avg non-null `pvi`.
- [ ] Types + API client + error mapping (`Authentication required`, `invalid_timezone`).
- [ ] `HUDPage.tsx` + weekly bar component.
- [ ] Route `/hud` + header link.
- [ ] Tests: week-boundary fixtures (Sunday 23:59 vs Monday 00:01 in a named zone, e.g. `America/Los_Angeles`).
- [ ] Empty state: 0 minutes, bar empty, copy that no locked sessions count yet.

#### Planning questions

- Show week P.V.I. average on the same card in Phase 1, or wait for Phase 2 visual density?
- Home page CTA to HUD for signed-in users?

#### Out of scope

- Daily status, attrition grid, domain chart.
- Client-side sum of `fetchMySessions()`.

---

### Phase 2 — Daily status & attrition log

**Planning goal:** Immediate status clock and 12-week compliance row.

#### Scope

- Expand RPC: `lastLockedAt`, `attrition: boolean[12]`.
- `DailyTelemetry`: T-minus since last lock + ACTIVE / DORMANT / DETRAINING / NEVER.
- `AttritionGrid`: 12 squares.

#### Dependencies

- Phase 1 (RPC + page shell).

#### Deliverables

- [ ] SQL: 12 week buckets, same Monday-start as weekly baseline.
- [ ] `computeTimeSinceLastBurn` + status mapper (pure, tested).
- [ ] Attrition grid a11y labels.
- [ ] Tests: 24h / 48h boundaries; `never` when `lastLockedAt` is null; week 12 = current week.

#### Planning questions

- Refresh interval for the T-minus clock (1 min is enough; do not refetch telemetry every tick).

#### Out of scope

- Domain matrix.

---

### Phase 3 — Domain matrix & tactical warnings

**Planning goal:** Expose 30-day duration bias and fire imbalance warnings.

#### Scope

- Expand RPC: `domainMinutes30d`.
- `evaluateLoadImbalance` + warning strings.
- `DomainMatrixChart` SVG segmented bar (or four labeled ticks). No radar library.

#### Dependencies

- Phase 1.

#### Deliverables

- [ ] SQL: 30-day window grouped by duration.
- [ ] Pure function + tests (table below).
- [ ] Chart + warning line.
- [ ] Zero-volume 30d: no warning (cannot be imbalanced on nothing).

#### Planning questions

- Rolling 30 × 24h vs last 30 local calendar days? **Prefer rolling 30 × 24h from `now()`** (simpler SQL, matches “past 30 days” in the brief).

#### Out of scope

- Prescribing a specific workout template (warning names a **duration**, not a template id).
- Ghost overlay on HUD.

---

### Phase 4 — Benchmark Matrix (Volume × Lethality)

**Planning goal:** Close the low-intensity volume loophole. Classify the current (and previous) local week by volume **and** workout intensity, and surface a Classification Badge with a next-tier checklist on the HUD.

#### Intensity taxonomy (1–5)

Templates live in [`src/data/workoutTemplates.ts`](src/data/workoutTemplates.ts) (not a DB table). Each library template resolves to `intensityTier` via `resolveTemplateIntensity()`. Intensity is **snapshotted** onto `sessions.intensity_tier` at create time so server aggregation does not depend on TS.

| Tier | Label | Meaning |
| --- | --- | --- |
| 1 | Active Recovery | Low CNS tax |
| 2 | Foundational | Sustainable bodyweight mechanics |
| 3 | Tactical | High metabolic demand / explosive or isometrics |
| 4 | Crucible | Severe CNS drain, complex multi-joint |
| 5 | Tier 1 | Hypoxia + agonizing isometrics |

**Category defaults:** aerobic-matrix → 2; blood-shunt / localized-trap / engine-room / midline-tension → 3; four-point-cascade → 4; armor-protocol → 4 (override to 5 for explicit Tier 1 cues).

**Custom workouts** (no `template_id`): count toward **volume**; intensity treated as **2** — cannot satisfy Intensity 3+ / 4+ lethality quotas.

#### Weekly classifications (re-earned every Mon–Sun local week)

| Rank | Volume | Lethality | Domain |
| --- | --- | --- | --- |
| CIVILIAN | ≥ 150 min | — | — |
| OPERATOR | ≥ 240 min | ≥ 2 sessions with intensity ≥ 3 | — |
| SPECIAL OPS | ≥ 300 min | ≥ 3 sessions with intensity ≥ 4 | ≥ 1 × 20-min Marathon |
| UNCLASSIFIED | below Civilian | — | — |

Highest rank meeting **all** criteria wins. Eligibility unchanged: claimed + locked; clock = `psr.updated_at`.

#### Deliverables

- [x] `intensityTier` resolution on templates; `sessions.intensity_tier`; `create_session` snapshot
- [x] `hud_telemetry` returns `classification.current`, `classification.previous`, `classification.progress`
- [x] `ClassificationBadge` + next-tier checklist atop HUD (Baseline bar remains)
- [x] Tests: classification / checklist pure functions; parser; badge empty state

#### Out of scope

- Lifetime ranks / XP; friends classification leaderboard; requiring templates for all sessions

---

### Phase 4.5 — Tactical Prescription

**Planning goal:** Point the athlete at the fire. Cards that fulfill an unmet next-tier lethality or domain quota get a brutalist `MANDATE` badge on create-session. Easy work stays visible.

#### Intensity is explicit

Every library template hardcodes `intensityTier: 1 | 2 | 3 | 4 | 5`. No category fallback. Snapshot at create still uses the template field; custom workouts remain **2**.

| Category | Tier |
| --- | --- |
| `aerobic-matrix` | 2 |
| `blood-shunt` / `localized-trap` / `engine-room` / `midline-tension` | 3 |
| `four-point-cascade` | 4 |
| `armor-protocol` (standard) | 4 |
| `the-trench`, `iron-will`, `the-shield` | 5 |

No Intensity 1 templates in this phase.

#### Prescription hierarchy

`getTemplatePrescription(template, current, progress)` — first match wins:

| `current` | Badge |
| --- | --- |
| `unclassified` | none (Civilian is volume only) |
| `civilian` | `MANDATE: INTENSITY 3+` if I3+ quota open and `intensityTier >= 3` |
| `operator` | `MANDATE: MARATHON` if marathon quota open and duration is 20; else `MANDATE: TIER 4+` if I4+ quota open and `intensityTier >= 4` |
| `special_ops` | none — already top; badges disappear |

Marathon beats Tier 4+ when both apply.

#### Guest ruling

HUD RPC requires auth. Guests can still create sessions. Skip fetch; render cards without mandates. Do not block create.

#### Deliverables

- [x] `intensityTier` required on every library template
- [x] `getTemplatePrescription` + tests
- [x] `useHudTelemetry` shared by HUD + create-session
- [x] `MANDATE` pill on `WorkoutTemplateCard` (do not hide easy templates)

#### Out of scope

- Auto-generated custom workouts; hiding easy templates; changing classification thresholds

---

### Phase 5 — The Intake Dossier

**Planning goal:** Capture biometrics and a declared (ego) rank. Block HUD and session creation until the dossier exists. Join stays guest-open. Guests can no longer create.

#### Schema

`athlete_profiles`: `user_id` PK, `height_cm`, `weight_kg`, `birth_year`, `biological_sex` (`M` | `F`), `perceived_classification` (`civilian` | `operator` | `special_ops`). Weight/height/year/sex stay editable. Perceived rank may **only increase**. Verified rank is weekly HUD telemetry — the declared claim is never overwritten by a single workout.

#### Gates

- `/hud` and `/create` require auth + dossier (`RequireIntake`)
- `create_session` requires `auth.uid()` and a dossier row; `anon` execute revoked
- `/join` and `/session/:id` unchanged; My Sessions stays open

#### Ego trap

If `verified < perceived`: badge reads **Claimed: OPERATOR | Verified: CIVILIAN**. Checklist shows claimed-rank requirements. Template badges use `PROVE IT:` targeting the **claimed** rank.

If `verified >= perceived`: Claimed copy disappears; Phase 4.5 `MANDATE:` next-tier resumes.

Civilian claim is volume-only (no template prove-it badges).

#### Deliverables

- [x] `athlete_profiles` + get/upsert RPCs; `create_session` auth + dossier gate
- [x] `/intake` UI + `RequireIntake`
- [x] ClassificationBadge claimed vs verified
- [x] `getTemplatePrescription` PROVE IT override

#### Out of scope

- Auto-rewriting perceived rank from one session; friends seeing claims; gating My Sessions or join

---

### Phase 5.5 — Biometric Scaling

**Planning goal:** Scale Civilian and Operator weekly compliance quotas by age bracket and biological sex. Special Ops stays an absolute standard.

#### Age brackets

Age = current calendar year − `birth_year`. Under-18 maps to Alpha.

| Bracket | Ages |
| --- | --- |
| Alpha | ≤ 25 |
| Bravo | 26–35 |
| Charlie | 36–45 |
| Delta | ≥ 46 |

#### Quota matrix

| Rank | Alpha/Bravo M | Alpha/Bravo F | Charlie M | Charlie F | Delta M | Delta F |
| --- | --- | --- | --- | --- | --- | --- |
| Civilian minutes | 150 | 135 | 135 | 120 | 135 | 120 |
| Operator minutes | 240 | 220 | 210 | 210 | 180 | 180 |
| Operator I3+ | 2 | 2 | 1 | 1 | 1 | 1 |
| Special Ops | 300 min + 3× I4+ + 1× 20-min Marathon (all cells) | | | | | |

#### Deliverables

- [x] `biological_sex` on `athlete_profiles`; 5-arg upsert; intake Male/Female
- [x] `classificationQuotas` + `resolveWeeklyClassification` / `hud_telemetry` twin
- [x] HUD checklist footnote; weekly bar and attrition use scaled Civilian minutes
- [x] Operator I3+ template prescription uses scaled quota

#### Out of scope

- Changing workout difficulty; forcing existing dossiers to re-file (DEFAULT `'M'`)

---

## Phase dependency graph

```
Locked scores + claimed user_id (already shipped)
    ↓
Phase 1 (RPC + weekly 150 bar + /hud)
    ↓
    ├── Phase 2 (daily clock + attrition)
    ├── Phase 3 (domain matrix)
    └── Phase 4 (Benchmark Matrix)  -- after intensity snapshot exists
            ↓
         Phase 4.5 (Tactical Prescription)  -- mandates on template picker
            ↓
         Phase 5 (Intake Dossier)  -- claimed vs verified + create gate
            ↓
         Phase 5.5 (Biometric Scaling)  -- age/sex Civilian+Operator quotas
```

---

## Suggested module layout

```
supabase/migrations/YYYYMMDDHHMMSS_hud_telemetry.sql

src/lib/hud/
  types.ts
  computeTimeSinceLastBurn.ts
  computeTimeSinceLastBurn.test.ts
  evaluateLoadImbalance.ts
  evaluateLoadImbalance.test.ts
  formatWeekCountdown.ts
  formatWeekCountdown.test.ts
  resolveWeeklyClassification.ts
  classificationQuotas.ts
  nextTierChecklist.ts
  getTemplatePrescription.ts
  compareClassificationRank.ts

src/lib/workout/
  resolveTemplateIntensity.ts

src/hooks/useHudTelemetry.ts
src/hooks/useAthleteProfile.ts
src/pages/IntakePage.tsx
src/components/RequireIntake.tsx

src/lib/api/hudTelemetry.ts

src/pages/HUDPage.tsx
src/components/hud/
  WeeklyBaselineBar.tsx
  DailyTelemetry.tsx
  AttritionGrid.tsx
  DomainMatrixChart.tsx
  ClassificationBadge.tsx
```

SQL lives in the migration. Do not duplicate week-boundary math in TypeScript except for countdown / status clocks that take already-correct ISO timestamps from the server.

---

## `evaluateLoadImbalance()` — required tests

Pure function. Input is minutes per domain. Output:

```ts
export type LoadImbalanceResult =
  | { imbalanced: false }
  | { imbalanced: true; dominant: 5 | 10 | 15 | 20; share: number; warning: string };
```

**Rule:** Among domains `{5, 10, 15, 20}` only, if `total = sum(those four) > 0` and `max(domain) / total > 0.60`, fire. `other` is ignored for the ratio.

| Case | Input (5, 10, 15, 20, other) | Expected |
| --- | --- | --- |
| Empty | all 0 | `imbalanced: false` |
| Only other | other = 90 | `imbalanced: false` |
| Balanced | 40, 40, 40, 40 | `imbalanced: false` (25% each) |
| Exactly 60% | 90, 30, 20, 10 | `imbalanced: false` (strictly **>** 60%) |
| Just over 60% | 61, 13, 13, 13 | `imbalanced: true`, dominant 5 |
| Sprint hide | 120, 10, 10, 10 | dominant 5, Marathon warning |
| Marathon hide | 10, 10, 10, 120 | dominant 20, Sprint warning |
| Crucible hide | 10, 120, 10, 10 | dominant 10 |
| Grind hide | 10, 10, 120, 10 | dominant 15 |
| Other padded | 80, 10, 10, 0, other 500 | still imbalanced on 5 (other excluded) |
| Tie at >60% | impossible if single max; if two equal maxima both ≤ 60%, false | |

Share stored as a 0–1 ratio or percent — pick one and test exactly (recommend percent rounded to 1 decimal, same as P.V.I.).

---

## Technical constraints & guardrails

- **Auth required.** RPC raises / returns like `my_sessions()` when `auth.uid()` is null. UI: same guest copy as My Sessions.
- **No partial credit.** Unlocked `participant_segment_results` (partial_reps only, no breakdown) do not count.
- **No guest credit.** Unclaimed participants never enter the sum.
- **Do not use Edge Function** unless an RPC hits statement timeout; if that happens, wrap the same SQL with the existing Deno CORS/auth pattern from `submit-participant-result` — do not invent a second aggregation path.
- **Zero visual fluff.** No confetti, streaks-with-fire-emojis, or gradient celebration at 150. Bar fills; numbers tick; squares are on or off.
- **Import map:** HUD SQL does not need the scoring TypeScript import map. Do not pull `computePvi` into Deno for this epic.

---

## Success metrics

| Metric | Target |
| --- | --- |
| Week boundary | Sunday 23:50 lock in `America/Los_Angeles` counts in that week; Monday 00:10 counts in the next |
| Eligibility | Unclaimed or unlocked sessions never increment `weekMinutes` |
| 150 bar | Visual fill caps at 100%; label can read `200 / 150` |
| Imbalance | All table cases above pass without UI |
| Payload size | Telemetry JSON stays a small constant — not a session list |

---

## References

- Claimed history: [`src/lib/api/mySessions.ts`](src/lib/api/mySessions.ts), `my_sessions()` RPC
- Score lock: [`supabase/functions/submit-participant-result/`](supabase/functions/submit-participant-result/)
- P.V.I. + domain weights: [`src/lib/scoring/`](src/lib/scoring/)
- Time domains: [`src/data/workoutTemplates.ts`](src/data/workoutTemplates.ts) (`TimeDomain`)
- Ghost eligibility (same lock predicate): [`available_ghosts`](supabase/migrations/20260824140000_session_template_id_and_ghost_rpcs.sql) (`score_breakdown IS NOT NULL`)
- App routes: [`src/App.tsx`](src/App.tsx)
- Header nav: [`src/components/AuthHeaderActions.tsx`](src/components/AuthHeaderActions.tsx)
- Scoring epic (prior art for phase slices): [`docs/epics/amrap-scoring-algorithm.md`](docs/epics/amrap-scoring-algorithm.md)
