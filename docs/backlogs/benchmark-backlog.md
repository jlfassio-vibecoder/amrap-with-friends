# Backlog: Benchmark programming

**Branch:** `claude/landing-page-update-uawasu`
**Status:** D shipped · E and C queued · B rejected as a column · A content-gated
**Last updated:** 2026-08-30

---

## Why these four exist

The planner measures a campaign by running one fixed workout in week one and
again at the end (see the campaign notes in [CLAUDE.md](../../CLAUDE.md) and
[`planCampaignWorkouts`](../../src/lib/campaign/planCampaignWorkouts.ts)). That
is a promise about a number staying comparable. Three of these items defend the
promise; the fourth would change the workouts underneath it.

Athletes care about a personal number that means the same thing twice. That
breaks when the number quietly changes meaning (a library edit under a frozen
id), when the host did not mean to measure this track, or when the personal
story is buried under crew ranking. Hence the order: **defend the number (E),
make the promise visible at create (C), then decide presentation (B) from
evidence.**

|     | Item                       | Verdict                  | Why for the athlete                          |
| --- | -------------------------- | ------------------------ | -------------------------------------------- |
| 1   | **E** — Freeze the library | Do next                  | Makes every future "+N reps" trustworthy     |
| 2   | **C** — Measured on this   | Do after E               | Hosts choose the promise the crew lives with |
| 3   | **D** — The test section   | In flight                | The personal story, separate from ranking    |
| 4   | **B** — Delta in Standings | **Rejected as a column** | Ranking on improvement rewards a soft start  |
| —   | **A** — Tier variants      | Leave (A3)               | Content-gated; nothing to schedule           |

---

## E — Freeze the benchmark library

**Do next.** Not a UI feature — the precondition for every other progress
surface.

### The gap

[`campaignBenchmarks.test.ts`](../../src/lib/campaign/campaignBenchmarks.test.ts)
asserts that every benchmark id resolves in `WORKOUT_TEMPLATES`, sits in the
track it claims to test, and is unique. It does **not** assert that the workout
behind the id is unchanged. Editing `the-hemodynamic` from 12 reps to 15 passes
every test in the repo, and results recorded before and after that edit become
two different numbers compared as one.

### Blast radius — narrower than it sounds

In-flight campaigns are safe. `campaign_occurrences.workout` is resolved jsonb
written at create time, and `run_campaign_scheduler()` copies it into
`sessions.workout` — a library edit never reaches a scheduled session. What
breaks is comparison _across_ the edit: a result from a campaign created before
it against one created after.

This is silent measurement drift, not data corruption. That is what a CI guard
is for and what a runtime check is not.

### Plan (locked)

1. Add `src/lib/campaign/benchmarkFingerprints.ts` — a checked-in
   `Record<templateId, string>` of canonical fingerprints.
2. Fingerprint **only score-affecting fields**: `durationMinutes`, `category`,
   and each movement's `name`, `reps`, `unit` in order. Deliberately not `name`,
   `focus` or `tacticalNote` — if a typo fix in a coaching note trips the guard,
   people learn to update the table without reading it and the guard is worth
   nothing.
3. Assert in `campaignBenchmarks.test.ts`, with a failure message that says what
   it means, not just what differs:

   > `the-hemodynamic` has changed. Results recorded against it are no longer
   > comparable. To change a benchmark workout, add a new template with a new id
   > and point the benchmark table at it — do not edit this one. If that is what
   > you meant, update `benchmarkFingerprints.ts` in the same commit.

4. Add a "Changing a benchmark workout" note to `CLAUDE.md` beside the existing
   architecture bullet.

**Canonical strings, not hashes.** Fifteen entries at ~100 characters each is
nothing, and a reviewer who sees `10|blood-shunt|Fast Air:12|…` change in a diff
understands instantly what moved. A changed hex string tells them only that
something did. Hashing is the reflex here and it is the worse call.

### Precedent

The database already does this. `coach_workout_is_locked`
(`supabase/migrations/20260829130000_coach_wod_lock_and_clone.sql`) locks a coach
workout once a completed session references it, derives that state from data
rather than a stored flag, and offers _clone_ as the escape hatch. This is the
same rule for the TypeScript library, enforced in CI because CI is the only gate
the library passes through — and the escape hatch is identical: a new id, never
an edit.

### Boundary

No SQL, no migration, no runtime check. CI only.

---

## C — Measurement-track picker

**Do after E.** A gap in code that already shipped.

### The gap

[`planCampaignWorkouts`](../../src/lib/campaign/planCampaignWorkouts.ts) takes
`tracks[0]` as the measurement track.
[`CampaignTrackPicker`](../../src/components/campaign/CampaignTrackPicker.tsx)
appends on toggle, so **the first style the host happens to tap silently becomes
the thing the campaign is measured on**. Removing that chip promotes the next one
and re-benchmarks the campaign onto a different workout. The preview does update
— it is a `useMemo` — so a host who is watching sees week one's workout change.
Nothing tells them why.

A wrong benchmark produces a false delta weeks later, which is worse than no
delta.

### Plan (locked)

1. **Keep the contract.** `tracks[0]` stays the measurement track. No new state
   shape and nothing to migrate: campaigns do not persist tracks at all —
   `create_campaign` sends occurrences only — and the measurement track is
   recoverable after the fact from the benchmark occurrence's `templateId` via
   `deriveCampaignRoles`.
2. **Make the invisible rule visible.** In the "In this campaign" chip list, the
   first chip carries a _Measured on this_ marker; every other chip gets a
   _Measure on this_ action that moves it to the front of the array.
3. One line under the plan heading: _"Measured on {category} · {N} min."_ It
   changes when the host reorders or removes, which is the point of it.
4. **Do not block removing the measured chip** — promote the next one. A blocked
   control needs explaining; a visible fact does not.

### The control's name

Never "Benchmark". The glossary defines _Benchmark_ as **a campaign's opening
session**. A style is not a session, and a second meaning for a word defined this
week is how a glossary rots. _Measured on this_ passes the click test and stays
out of the noun table entirely.

### Tests

- Pure — `planCampaignWorkouts`: reordering tracks changes the benchmark and the
  retests and nothing else; the build rotation still covers the same templates.
- Component — `CampaignTrackPicker`: "Measure on this" reorders; removing the
  first chip promotes the second; the marker follows.
- Render the create page at two and three tracks. The last four phases each
  turned up a real bug that way and none of them showed in tests.

### Boundary

Create page only. No schema, no detail page, no standings.

---

## B — Delta in Standings

**Rejected as a column.** The evidence gate is open to _observe_, not to
implement.

### Why not

1. **Delta is not rankable.** An athlete who starts unfit has more room to
   improve. Put a delta column in a ranked table and readers rank on it, because
   that is what a ranked table is for. Standings ranks on normalised average —
   rate within each session, where everyone ran the same workout — which is fair.
   Delta beside it borrows that authority for a number that has not earned it.
2. **Mixed units.** Normalised average is a ratio rendered as a percentage;
   delta is absolute reps. One table, two scales, no shared axis.
3. **Late joiners.** A member who joined after the benchmark has no week-one
   score, so their Change cell is an em dash forever. In "The test" that reads as
   _not part of this test_. In Standings it reads as a hole in their row.

`computeCampaignStandings` ranking rules stay independent of roles.

### Evidence to gather now that D is live

Do people stop at Standings, or scroll to "The test"?

- **"The test" wins attention** → the later merge should _lead with delta_,
  folding average and attendance into or under it. That is a different change
  from adding a column, and a better one.
- **Standings wins attention** → improve "The test"'s hierarchy, copy and empty
  states before adding columns anywhere.

Do not implement the merge until a few real campaigns have scored retests.

### If a merge ever happens — mechanics

- **Join in the page, not in the pure functions.** A `Map<userId, testRow>` keyed
  off the standings rows. `computeCampaignStandings` and
  `computeCampaignTestProgress` both consume the same matrix and stay
  independent.
- _Rejected:_ passing roles into `computeCampaignStandings` and emitting delta
  there. It couples ranking rules to programming rules; the next change to either
  breaks both.
- Column order `Rank | Athlete | Average | Change | Sessions attended` — Change
  adjacent to Average so the units contrast is visible rather than implied.
- **No sort affordance on Change**, with a comment saying why, or someone will
  "fix" it.

---

## A — Tier variants

**Leave (A3).** Content-gated, and the library settles it.

| Track                                              | Templates | Intensity tiers present |
| -------------------------------------------------- | --------- | ----------------------- |
| 5, 10 and 15 min — all four categories (12 tracks) | 10 each   | 3 only                  |
| 20 min · Aerobic Matrix                            | 10        | 2 only                  |
| 20 min · Four-Point Cascade                        | 10        | 4 only                  |
| 20 min · Armor Protocol                            | 10        | 4 (×7), 5 (×3)          |

**Fourteen of fifteen tracks are single-tier.** Tier is a property of the
category, not a ladder inside it. Armor Protocol is the only internal difficulty
gradient anywhere in the library.

That kills the cheap version before anyone spends a day on it: "order the pool by
tier, then by volume" buys progression in exactly one track out of fifteen. Not
worth a code path.

### The three options

- **A1 — author the ladder.** Four categories × three short durations × ten
  workouts per tier level = **120 workouts per level**; a tier below and above is 240. A coach's job, not an engineering task. The ask is narrow enough to write
  down: for each of the twelve short-duration tracks, the same ten workouts
  re-prescribed one tier down and one tier up, keeping movement selection and
  changing only rep targets and movement difficulty. Landing it afterwards is
  data entry plus a widened `filterWorkoutTemplates` and a tier control on the
  track picker.
- **A2 — derive variants by scaling reps in code.** One rule decides whether it
  is safe or worthless: **scaling must never apply to a benchmark or a retest.**
  Scaling changes rounds-per-session, which is precisely what the benchmark
  measures. Even enforced, it is strictly worse than A1: derived scaling gives
  you volume, and `orderPoolByVolume` already gives you volume. **Do not build
  A2.**
- **A3 — do nothing, deliberately.** The benchmark and retest pair already
  supplies a progression signal and costs nothing to author. Current state, and
  defensible indefinitely.

**A3 until someone commissions A1's content.**

---

## House style: the minus glyph

[`formatCampaignRepDelta`](../../src/lib/campaign/computeCampaignTestProgress.ts)
uses U+2212 (`−`).
[`GhostPacerStrip`](../../src/components/GhostPacerStrip.tsx)'s `formatDelta`
still renders `-3 Reps Behind` with an ASCII hyphen from the number itself.

**U+2212 is the house style.** Fold the Ghost strip in next time a formatter
there is touched — not a standalone slice.

---

## Parked: motivation polish

Amplifies D; does not replace E or C. Defer until after C.

- Highlight the viewer's own row in "The test" ("You").
- Empty state after week one: "Your number is set — retest in week N."
- A mid-checkpoint column, only if mid-retests feel invisible under "Latest
  retest".
