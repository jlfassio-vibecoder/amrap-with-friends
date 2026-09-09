# HUD Architectural Assessment And Gap Analysis

## Executive Summary

The HUD is architecturally coherent and already follows several strong patterns
 in this codebase:

- one primary server-side telemetry read model
- strict client parsing at the API boundary
- a healthy pure-logic layer in `src/lib/hud/`
- mostly focused visual components
- explicit separation between "live now" telemetry and inspectable week history

The feature is past the "new page" stage and is now a subsystem. Its biggest
architectural risk is not fragmentation but concentration: too much product
meaning is accumulating in one RPC and one composition page. That has worked
well so far because the client stays simple, but it creates a growing blast
radius in SQL, onboarding cost for future contributors, and a widening gap
between what the HUD does and what the existing docs still describe.

The HUD does not need a rewrite. It needs consolidation:

1. a refreshed source-of-truth architecture document
2. stronger SQL verification
3. a deliberate read-model strategy for future HUD expansion
4. clearer boundaries between core HUD telemetry and adjacent modules

## Scope Assessed

This assessment was based on the current HUD implementation and adjacent
dependencies, especially:

- `src/pages/HUDPage.tsx`
- `src/hooks/useHudTelemetry.ts`
- `src/lib/api/hudTelemetry.ts`
- `src/lib/hud/*`
- `src/components/hud/*`
- `src/hooks/useBenchmarkProgress.ts`
- `src/hooks/usePhysicalActivityLog.ts`
- `src/lib/api/physicalActivity.ts`
- `docs/epics/hud-telemetry.md`
- `supabase/migrations/*hud*`
- `supabase/scripts/verify_hud_telemetry.sql`

## Current Architecture

### 1. System Shape

The HUD is built around a central read contract:

`auth user -> hud_telemetry RPC -> defensive API parser -> pure logic -> page composition -> cards/charts`

That is the right high-level architecture for this product because:

- the HUD is aggregation-heavy
- the source tables are RLS-locked
- timezone-correct bucketing belongs on the server
- the client needs compact telemetry, not an ever-growing event list

### 2. Page Composition

`src/pages/HUDPage.tsx` acts as the integration root. It combines:

- core telemetry from `useHudTelemetry()`
- quota/profile context from `useAthleteProfile()`
- benchmark progress from `useBenchmarkProgress()`
- outside activity logging from `usePhysicalActivityLog()`
- pure client derivations such as overtraining evaluation, score trend shaping,
  week selection, and activity attribution

This means the page is not just a view for one payload. It is a multi-source
dashboard that uses HUD telemetry as the spine and layers adjacent concerns on
top.

### 3. Data Layer Contract

`src/lib/api/hudTelemetry.ts` is one of the strongest pieces in the feature.
It does three important things well:

- isolates the RPC name and error mapping
- validates every nested shape defensively
- tolerates some migration skew by degrading specific optional slices to empty
  collections or defaults instead of killing the whole HUD

This parser is effectively a schema firewall between Postgres and React.

### 4. Domain Layer

The HUD follows one of the repo's best conventions: pure logic beside tests.
Examples include:

- `evaluateOvertrainingRisk()`
- `evaluateLoadImbalance()`
- `scoreTrendFromHistory()`
- `resolveWeeklyClassification()`
- `nextTierChecklist()`
- `formatWeekCountdown()`
- week-history navigation helpers

This is exactly the right place for rules that are product-specific but not UI
specific.

### 5. UI Layer

Most HUD components are focused and legible. The strong pattern is:

- server provides already-aggregated facts
- pure helpers derive explanation-level values
- components render operational copy with minimal hidden logic

The charts also follow repo conventions by staying lightweight SVG rather than
introducing a charting library.

### 6. Database Evolution

The HUD's SQL history shows additive evolution rather than churn. New payload
keys were appended over time:

- baseline telemetry
- attrition
- benchmark/classification concepts
- activity7d
- week PVI missions
- inspectable week history
- active recovery domain accounting
- overtraining metrics

That is a healthy sign for product iteration, but it also means the real HUD
design now lives more in migration history than in one current document.

## What Is Working Well

### Strong Architectural Decisions

- **Single telemetry RPC as a read model.** The HUD avoids the common SPA trap
  of downloading mission history and rebuilding server logic in the browser.

- **Strict boundary parsing.** `parseHudTelemetryPayload()` protects the UI from
  malformed or partially migrated payloads.

- **Good degradation strategy.** New optional payload areas such as
  `weekPviMissions`, `weeks`, and `activeRecovery` can be absent without making
  the whole page unusable.

- **Pure logic is respected.** Complex product rules are not trapped inside
  JSX-heavy components.

- **Time-travel scope is disciplined.** Only week inspection travels through
  history; alerts and live status stay pinned to the present.

- **No chart-library dependency.** The HUD stays portable, lightweight, and
  understandable.

- **Locked-state semantics are consistent.** Across the HUD, "counts" usually
  means claimed + locked mission state, not loose participation.

### Product/Architecture Alignment

- The page matches the repo's read-heavy RPC pattern.
- The language and interaction model preserve the app's tactical brand without
  making the information architecture opaque.
- Demographic scaling lives in pure logic and SQL rather than leaking across
  components.

## Gap Analysis

## High Severity Gaps

### 1. The main HUD architecture doc is materially behind the shipped feature

`docs/epics/hud-telemetry.md` is still valuable for intent, but it no longer
describes the actual HUD in enough detail to function as the current source of
truth. It under-represents at least:

- outside activity logging and attribution
- benchmark progress on the HUD
- week-history inspection
- active recovery treatment inside domain totals
- richer overtraining semantics
- the intake/quota coupling that now shapes baseline and classification

Impact:

- future contributors will misread scope
- new work may extend the wrong abstraction
- migration changes can outpace docs unnoticed

Recommendation:

- maintain one current architecture doc for the HUD subsystem, separate from the
  historical epic
- keep the epic as planning history, not the authoritative implementation map

### 2. `hud_telemetry` is turning into a multi-concern super-RPC

The current RPC is doing all of the following:

- timezone validation
- quota lookup
- weekly aggregation
- prior-week aggregation
- rank resolution
- verified-rank history writing
- last-lock lookup
- attrition bucketing
- 12-week detail bucketing
- 30-day domain distribution
- 7-day activity summary
- overtraining input packaging

This keeps the client clean, but the cost is growing SQL centralization. The
function is now read model, business rules engine, timeline bucketizer, and
state writer in one place.

Impact:

- small feature additions now increase risk disproportionately
- SQL review difficulty is rising
- one regression can disturb several surfaces at once
- the write side effect inside a read path makes behavior less obvious

Recommendation:

- keep the single client-facing RPC for now, but refactor the SQL behind it into
  helper SQL functions or views where possible
- explicitly document which parts are pure reads and which parts have side
  effects
- consider whether verified-rank history insertion belongs on the critical read
  path or should be shifted elsewhere

### 3. The most important HUD logic is the least automatically verified

The repo has strong TypeScript and React tests, but the HUD's server contract
still relies heavily on manual SQL verification via
`supabase/scripts/verify_hud_telemetry.sql`.

Impact:

- timezone/week-boundary regressions can slip through
- migration ordering or replay problems are easier to miss
- classification and week-history drift can occur below the parser

Recommendation:

- add automated DB-level verification for the HUD contract
- prioritize:
  - timezone boundary cases
  - attrition ordering
  - week-history ordering and mission inclusion
  - active-recovery exclusion from core domain totals
  - classification parity between SQL and TypeScript expectations

## Medium Severity Gaps

### 4. `HUDPage` is becoming an orchestration bottleneck

The page is still readable, but it now owns:

- auth gating interpretation
- telemetry loading states
- profile/quota interpretation
- outside-activity summarization
- overtraining derivation
- benchmark-progress integration
- history selection state
- conditional rendering for many separate cards

This is acceptable today, but it is nearing the point where any new HUD feature
will naturally get bolted into the page body first.

Impact:

- slower onboarding to the page
- more fragile render-level coordination
- rising chance of duplicated derivation across cards

Recommendation:

- introduce a thin `useHudViewModel()` or `useHudScreenData()` layer if the HUD
  grows further
- use it to gather cross-card derivations, not to hide simple rendering logic

### 5. Auth-transition behavior in HUD-adjacent hooks is a correctness and privacy risk

Several HUD-adjacent hooks are keyed more to broad auth state than to identity:

- `usePhysicalActivityLog()` does not refetch on user identity change
- `useBenchmarkProgress()` depends only on an `enabled` boolean
- HUD-related hooks retain local state in ways that may preserve prior-account
  data until remount or explicit refetch

Impact:

- stale data can survive account switches
- one authenticated user may briefly see another user's HUD-adjacent state
- page behavior depends more on mount order than it should

Recommendation:

- audit HUD-adjacent hooks for identity-keyed resets and refetches
- add explicit state clearing when auth/user changes
- treat account-switch behavior as a first-class HUD integration case in tests

### 6. The HUD is one screen but not one read model

The user experiences one dashboard, but the implementation spans:

- `hud_telemetry`
- benchmark overview fetch
- athlete profile fetch
- physical activity list fetch
- best-effort AMQAP repair before telemetry load

This is a reasonable practical compromise, but it means the HUD is not a single
consistently versioned snapshot. Different sections can succeed or fail
independently.

Impact:

- cards can silently disappear or lag while others render
- debugging "what did the HUD mean at this moment" is harder
- eventual realtime support would need careful consistency design

Recommendation:

- keep these separate unless performance or consistency becomes a product issue
- but document the HUD as a federated dashboard rather than implying it is only
  `hud_telemetry`
- if stronger consistency is needed later, define a broader HUD read model
  intentionally rather than accreting one by accident

### 7. Side-effect repair on read is pragmatic but fragile

`useHudTelemetry()` calls `repairUnlockedAmqapScores()` before fetching the HUD.
The comment explains why, and the intent is practical, but this means a page
load performs a best-effort mutation to make telemetry accurate.

Impact:

- a read path has hidden write semantics
- failures are swallowed by design
- the HUD may show stale state if repair fails

Recommendation:

- keep it if necessary, but document it explicitly in the HUD architecture
- longer term, move score-lock repair closer to mission-finish guarantees so the
  HUD does not need to heal upstream inconsistencies

### 8. Classification rules are duplicated across SQL and TypeScript

This codebase already acknowledges that SQL is the source of truth for current
HUD classification, while TypeScript provides pure twins. That is sensible, but
it remains duplication.

Impact:

- future rule changes can drift between layers
- tests can validate each side independently while still missing parity gaps

Recommendation:

- whenever quotas or classification rules change, require paired updates in SQL
  and TS plus parity-oriented tests or fixtures
- maintain a short checklist in HUD docs for "rule change touches"

## Lower Severity Gaps

### 9. Naming and conceptual boundaries inside the HUD are under-documented

There are several overlapping concepts:

- weekly baseline
- classification
- score trend
- overtraining
- domain matrix
- activity attribution
- benchmark progress
- physical activity log

Most are understandable in isolation, but there is no current short document
that explains which are:

- core HUD telemetry
- adjacent supporting surfaces
- write-capable tools embedded in the HUD
- reused modules that just happen to render there

Recommendation:

- maintain a "HUD capabilities map" in docs

### 10. Performance/caching behavior is implicit, not designed

The HUD appears to rely on simple mount-time fetches. That is fine for current
scale, but there is no explicit caching, refresh cadence, or invalidation
strategy documented for:

- telemetry
- benchmark progress
- physical activity entries

Recommendation:

- document current freshness assumptions
- if product expectations move toward live telemetry, design refetch behavior
  centrally instead of per-hook

### 11. Observability for telemetry correctness is minimal from the app side

The parser reports generic errors well enough for users, but there is little
evidence in this pass of richer internal diagnostics when payloads degrade due
to version skew or malformed nested shapes.

Recommendation:

- consider lightweight internal instrumentation for parse failure categories in
  non-test environments if HUD evolution accelerates

## Testing Assessment

### Current Strengths

- pure HUD logic appears well covered
- component tests exist for several HUD surfaces
- API parser tests exist for `hudTelemetry`
- manual SQL verification script captures key timezone expectations

### Main Gaps

- no clearly automated end-to-end verification of the actual RPC contract
- limited evidence of integration tests across the composed HUD page
- side-effect-before-read behavior is easy to miss in testing strategy
- limited direct coverage for auth/account transition behavior in HUD-adjacent
  hooks

### Recommended Test Additions

1. Add DB-level tests for `hud_telemetry`.
2. Add at least one HUD page integration test that exercises:
   - authenticated telemetry success
   - missing profile metrics prompt
   - week-history selection
   - benchmark section absence/failure tolerance
   - signed-out guest copy and `/hud` route gating
   - account switching between authenticated users
3. Add direct hook tests for:
   - `useHudTelemetry()`
   - `usePhysicalActivityLog()`
   - `useBenchmarkProgress()`
4. Add regression tests around parser degradation behavior for:
   - missing `activeRecovery`
   - missing `weeks`
   - malformed nested week mission shapes

## Documentation Assessment

### What Exists

- historical epic with strong design rationale
- migration comments that explain intent unusually well
- colocated comments in pure logic modules and components

### What Is Missing

- a current subsystem README for the HUD
- a concise map of data sources feeding the screen
- a description of read-path side effects
- a maintenance guide for evolving `hud_telemetry`
- updated SQL verification docs that match the current payload shape

This directory is intended to close part of that gap.

## Recommended Target Architecture

The HUD should continue using a server-side read-model pattern, but with clearer
internal boundaries:

### Keep

- one client-facing telemetry RPC
- strict client parsing
- pure derivation modules
- lightweight charting
- separate hooks for adjacent non-core features when justified

### Strengthen

- SQL modularity behind the RPC
- DB-level tests
- current architecture docs
- explicit freshness/consistency expectations

### Avoid

- rebuilding HUD aggregates from mission lists in the client
- pushing more raw SQL semantics into components
- adding many new cross-card fetches without a read-model plan
- letting the historical epic stand in for current subsystem documentation

## Suggested Next Steps

### Near-Term

1. Keep this `plans/hud` directory as the current documentation home for the
   feature area.
2. Add a short maintenance checklist for any `hud_telemetry` change:
   - update SQL
   - update parser
   - update TS types
   - update pure-twin rules if applicable
   - update verification coverage
   - update docs
3. Update `supabase/scripts/verify_hud_telemetry.sql` so its documented payload
   shape matches the current contract.
4. Add automated verification for the RPC's week-boundary and history behavior.

### Medium-Term

1. Refactor the SQL implementation into smaller helper functions or documented
   CTE sections if it grows further.
2. Introduce a screen-level view-model hook if `HUDPage` takes on more derived
   orchestration.
3. Harden HUD-adjacent hooks against authenticated account switching and state
   leakage.
4. Decide whether benchmark progress and physical-activity tooling are permanent
   HUD constituents or should become explicitly branded secondary panels.

### Longer-Term

1. Define whether the HUD should become realtime or remain snapshot-based.
2. Decide whether coach/admin surfaces will reuse the same telemetry model.
3. Consider whether verified-rank history mutation should remain inside the HUD
   read path.

## Bottom Line

The HUD is in good architectural shape for its stage. The core design choices
are sound, and the code shows strong discipline around domain logic, server-side
aggregation, and defensive boundaries.

The main gap is maturity of supporting architecture around the feature, not the
feature's conceptual design:

- documentation is behind reality
- SQL verification is behind TypeScript verification
- the read model is becoming dense enough to deserve first-class maintenance
  patterns

If those three gaps are addressed, the HUD can continue expanding without
needing a structural reset.
