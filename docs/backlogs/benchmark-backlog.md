# Backlog: Benchmark programming

**Branch:** `claude/landing-page-update-uawasu`
**Status:** D · E · C shipped · B rejected as a column · A content-gated · observe The test vs Standings
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
| 1   | **E** — Freeze the library | **Shipped**              | Makes every future "+N reps" trustworthy     |
| 2   | **C** — Measured on this   | **Shipped**              | Hosts choose the promise the crew lives with |
| 3   | **D** — The test section   | **Shipped**              | The personal story, separate from ranking    |
| 4   | **B** — Delta in Standings | **Rejected as a column** | Ranking on improvement rewards a soft start  |
| —   | **A** — Tier variants      | Leave (A3)               | Content-gated; nothing to schedule           |

---

## E — Freeze the benchmark library

**Shipped.** [`benchmarkFingerprints.ts`](../../src/lib/campaign/benchmarkFingerprints.ts)
holds canonical fingerprint strings of score-affecting fields only; CI asserts
them in [`campaignBenchmarks.test.ts`](../../src/lib/campaign/campaignBenchmarks.test.ts);
CLAUDE notes the escape hatch (new id + retarget + update fingerprints — never
edit in place).

In-flight campaigns stay safe (stored workout jsonb). The guard exists so
comparisons _across_ a library edit cannot silently mix two tests.

### Boundary

No SQL, no migration, no runtime check. CI only.

---

## C — Measurement-track picker

**Shipped.** `tracks[0]` remains the measurement track. Create UI shows
_Measured on this_ / _Measure on this_ on chips and a plan line
_"Measured on {label}."_ Never label the control "Benchmark" (glossary = session).

Removing the measured chip promotes the next one — do not block.

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

Amplifies D; does not replace E or C. Defer until after C (now shipped — still
parked pending evidence from live campaigns).

- Highlight the viewer's own row in "The test" ("You").
- Empty state after week one: "Your number is set — retest in week N."
- A mid-checkpoint column, only if mid-retests feel invisible under "Latest
  retest".
