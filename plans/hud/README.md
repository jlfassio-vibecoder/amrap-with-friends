# HUD

This directory holds planning and assessment material for the `HUD` surface in
AMRAP With Friends.

The HUD is the athlete-facing telemetry dashboard at `/hud`. It is not a
mission history page and it is not a marketing surface. Its job is to turn
locked mission history and adjacent recovery data into a current operational
readout: weekly compliance, classification, pacing quality, load mix,
overtraining signals, and short-range history that can be inspected week by
week.

## What The HUD Is

- A read-heavy dashboard backed by one primary RPC: `hud_telemetry(p_timezone)`.
- A composition root in `src/pages/HUDPage.tsx` that assembles several focused
  cards and charts.
- A domain-led feature area with substantial pure logic in `src/lib/hud/`.
- A place where server-side aggregation is preferred over client-side history
  assembly.

## What Lives Where

- `src/pages/HUDPage.tsx`
  The page orchestrator. Handles auth/profile gates, selects when to show the
  telemetry surfaces, and stitches together HUD cards plus adjacent features
  like benchmark progress and outside-activity logging.

- `src/hooks/useHudTelemetry.ts`
  The HUD data loader. Repairs unfinished AMQAP locks on a best-effort basis,
  then fetches telemetry once per authenticated mount.

- `src/lib/api/hudTelemetry.ts`
  RPC client and defensive payload parser. Converts the JSON envelope returned
  by Postgres into strict TypeScript shapes and gracefully tolerates some
  schema lag.

- `src/lib/hud/*`
  Pure logic for classification, week navigation, countdown formatting, load
  imbalance, score trends, overtraining evaluation, and activity summaries.

- `src/components/hud/*`
  The visual surfaces. Most components are presentation-heavy and receive
  already-derived data.

- `supabase/migrations/*hud*`
  The evolving database contract behind the HUD. The feature is intentionally
  RPC-driven, so a large part of the architecture is encoded in SQL.

## Core Contract

The current HUD architecture revolves around a single telemetry payload:

- Current-week minutes and pacing average
- Weekly contributing missions for pacing interpretation
- Time since last locked mission
- 12-week attrition booleans
- 12-week inspectable history buckets
- 72-hour, 7-day, and 30-day domain totals
- Weekly classification and progress to the next tier
- 7-day in-app activity rollup
- Overtraining inputs

That contract is intentionally richer than a list endpoint. The client is not
meant to reconstruct these views from mission rows.

## Architectural Principles

- Use locked mission state as the source of truth.
- Bucket time on the server, in the athlete's timezone.
- Keep transformations pure in `src/lib/hud/` whenever possible.
- Let the page compose cards; do not hide cross-card orchestration inside one
  mega component.
- Degrade gracefully across migration skew when possible, but not by silently
  inventing data.
- Keep the UI severe and legible rather than gamified.

## Main Inputs

- Authenticated athlete identity
- Athlete profile, especially demographic fields used for quota scaling
- Locked mission history and locked-at timestamps
- Mission intensity and duration
- Logged outside physical activity
- Benchmark progress data from a separate overview path

## Main Outputs

- Current weekly baseline state
- Verified classification and next-tier checklist
- Overtraining and recovery guidance
- Weekly pacing and score signals
- Domain-distribution warnings
- Inspectable short-term history
- Side-by-side in-app and outside-activity summaries

## Key Architectural Strengths

- Strong server/client boundary around telemetry aggregation
- Good use of pure logic modules with colocated tests
- Intentional tolerance for migration skew in the parser
- Clear separation between live-now surfaces and time-travel week inspection
- Brand-consistent but still fairly legible operational language

## Primary Architectural Risks

- `HUDPage` is becoming a dense integration surface with many independent data
  sources and UI responsibilities.
- The `hud_telemetry` RPC is accumulating many concerns, which makes schema
  evolution cheap for the client but raises complexity and regression risk in
  SQL.
- SQL verification is still largely manual; the most critical logic in the
  feature is therefore the least automatically checked.
- Some adjacent data flows are stitched together client-side from separate hooks
  instead of being modeled as a deliberate HUD read model.

## Documents In This Folder

- `README.md`
  High-level overview of the HUD feature area.

- `assessment-gap-analysis.md`
  Detailed architectural assessment, gap analysis, and recommended next steps.

## Suggested Use

Read the assessment before expanding the HUD in any of these directions:

- More telemetry cards
- More week-history detail
- Realtime updates
- Coach-facing HUD reuse
- Recovery/prescription expansion
- SQL payload expansion
