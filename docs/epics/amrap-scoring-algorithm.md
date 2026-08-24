# Epic: AMRAP Scoring Algorithm

**Branch:** `feature/amrap-scoring-algorithm`  
**Status:** Draft  
**Last updated:** 2026-08-24

---

## Vision

The AMRAP format is inherently chaotic. Without a ruthless, mathematically sound scoring algorithm, the app becomes a haven for rep-shaving and sloppy, ego-driven sprinting.

We are not just counting reps; we are quantifying **work capacity** and **tactical discipline**. The scoring system must evaluate both raw volume and pacing integrity so leaderboards reward athletes who do the work *and* hold the line under fatigue.

> "A leaderboard without standards is just a spreadsheet of lies. Reward the work, but multiply the discipline. Make them earn every single point."

---

## Current State (Baseline)

| Area | Today |
| --- | --- |
| Round logging | `rounds` table: `round_index`, `elapsed_sec_at_round`, `segment_index` |
| Live ranking | `buildLeaderboard()` sorts by **round count** only |
| Splits | `computeParticipantSplits()` derives per-round duration from elapsed timestamps |
| Workout model | JSON array of movements with optional `target` reps per round |
| Partial rounds | Not persisted — no rep-level progress into an incomplete round |
| Post-session score | Not stored; history shows round count only |

This epic replaces round-count-as-proxy with a full scoring pipeline and integrity UX.

---

## Master Architecture

### 1. Base Engine — Raw Work Capacity

The foundation is absolute volume. A round is a sum of its parts; every rep before the buzzer counts.

**Base Score Formula:**

```
Base Points = Total Reps Completed
```

**Example:** Workout = 40 reps per round. Athlete finishes 4 full rounds + 15 reps into round 5 → **Base Score = 175**.

---

### 2. Pace Variance Index (P.V.I.)

Separates athletes who can hold a redline from those who sprint early and collapse.

**Formula:**

```
P.V.I. = ((Slowest Round Time − Fastest Round Time) / Average Round Time) × 100
```

**Multiplier tiers** (applied to Base Score):

| Variance Rate | Classification | Multiplier | Verdict |
| --- | --- | --- | --- |
| 0% – 9.9% | Elite Pacing | **1.15×** | "Surgical precision. You controlled the panic." |
| 10% – 19.9% | Standard | **1.0×** | "Acceptable degradation. You survived." |
| 20% – 29.9% | Power Leak | **0.95×** | "You sprinted early and paid the tax. Check your ego." |
| 30%+ | System Failure | **0.85×** | "A complete tactical collapse. Unacceptable." |

**Rule:** For AMRAPs ≥ 10 minutes, exclude Round 1 from P.V.I. calculation (buy-in round).

---

### 3. Time Domain Scaling Matrix

Reps at minute 18 of a 20-minute AMRAP cost more than reps at minute 3 of a 5-minute sprint.

| Duration | Label | Domain Weight |
| --- | --- | --- |
| 5 min | Sprint | **× 1.0** |
| 10 min | Crucible | **× 1.2** |
| 15 min | Grind | **× 1.5** |
| 20 min | Marathon | **× 1.8** |

**Master equation:**

```
Final Leaderboard Score = (Total Reps × P.V.I. Multiplier) × Domain Weight
```

---

### 4. Leaderboard Mechanics & Integrity

- **Honesty Lock** — Pre-submit integrity affirmation; submit button reads **"I Earned This."**
- **Segmented leaderboards** — Highest Raw Score (engine) vs Best P.V.I. (tactician)
- **Ghost** — Race a previous best or a friend's pace with minute-by-minute comparison

---

## Phases

Each phase below is **one planning slice**. Plan, implement, and ship independently where dependencies allow.

---

### Phase 1 — Raw Work Capacity (Base Engine)

**Planning goal:** Define how total reps are captured, validated, and surfaced as Base Points.

#### Scope

- Compute **reps per round** from session workout definition (sum of movement targets).
- Persist **partial-round rep count** at session end (or on final log).
- Expose `baseScore` (total reps) on participant result objects.
- Replace round-count-only display where score is shown (live + post-session).

#### Dependencies

- None (foundational).

#### Deliverables

- [ ] Spec: rep counting rules (full round vs partial, multi-movement couplets/triplets/quadruplets).
- [ ] Data model: where partial reps live (new column, JSON field, or derived at finish).
- [ ] Pure function: `computeBaseScore(fullRounds, partialReps, repsPerRound)`.
- [ ] UI: show Base Points alongside or instead of raw round count where appropriate.
- [ ] Tests: edge cases (0 rounds, partial only, exact round boundary).

#### Planning questions

- Do we log partial reps incrementally during work, or only at timer finish?
- How do sec-hold movements (e.g. 20-sec Hollow Hold) convert to rep equivalents for Base Score?
- Is `repsPerRound` always derivable from `sessions.workout` JSON?

#### Out of scope

- P.V.I., domain weights, leaderboards beyond base ordering.

---

### Phase 2 — Pace Variance Index (P.V.I.)

**Planning goal:** Quantify pacing discipline and apply tiered multipliers to Base Score.

#### Scope

- Reuse `computeParticipantSplits()` round durations as P.V.I. inputs.
- Implement P.V.I. formula with **Round 1 exclusion** when `durationMinutes >= 10`.
- Map P.V.I. percentage → classification + multiplier (table above).
- Expose `pvi`, `pviClassification`, `pviMultiplier` on score result.

#### Dependencies

- Phase 1 (Base Score exists).
- Existing round timestamps (`elapsed_sec_at_round`).

#### Deliverables

- [ ] Pure function: `computePvi(roundDurationsSec, options: { excludeFirstRound: boolean })`.
- [ ] Pure function: `getPviMultiplier(pviPercent)` → `{ multiplier, classification, verdict }`.
- [ ] Tests: elite / standard / power leak / system failure boundaries; 9.9% vs 10%; single-round edge case.
- [ ] Document minimum rounds required for P.V.I. (e.g. ≥ 2 after exclusion).

#### Planning questions

- What is P.V.I. when athlete completes only 1 round (or 2 with exclusion)?
- Cap or floor on round duration outliers (e.g. accidental double-tap log)?
- Show live P.V.I. during session or only at finish?

#### Out of scope

- Domain weights, honesty lock, ghost.

---

### Phase 3 — Time Domain Scaling

**Planning goal:** Apply physiological domain weights so longer AMRAPs score comparably on leaderboards.

#### Scope

- Map `sessions.duration_minutes` → domain weight (1.0 / 1.2 / 1.5 / 1.8).
- Implement master equation: `(baseScore × pviMultiplier) × domainWeight`.
- Persist **final leaderboard score** on session completion.

#### Dependencies

- Phase 1 (Base Score).
- Phase 2 (P.V.I. multiplier).

#### Deliverables

- [ ] Pure function: `getDomainWeight(durationMinutes: 5 | 10 | 15 | 20)`.
- [ ] Pure function: `computeFinalScore({ baseScore, pviMultiplier, domainWeight })`.
- [ ] Score breakdown type: `{ baseScore, pvi, pviMultiplier, domainWeight, finalScore }`.
- [ ] Tests: full pipeline worked example (175 reps, 12% P.V.I., 15-min → expected final).

#### Planning questions

- Store breakdown JSON on participant/session for audit, or compute on read?
- Cross-duration global leaderboard, or always segmented by time domain?

#### Out of scope

- Segmented leaderboard UX, ghost, honesty lock.

---

### Phase 4 — Score Persistence & API

**Planning goal:** Make scores durable, queryable, and available to live + historical views.

#### Scope

- Schema migration for participant/session scores (or extend existing tables).
- RPC or finish-session hook to compute and persist score breakdown.
- Update `buildLeaderboard()` to rank by **final score** (tie-breakers TBD).
- My Sessions / history surfaces final score + breakdown.

#### Dependencies

- Phases 1–3 (complete scoring pipeline).

#### Deliverables

- [ ] Migration: score columns or `score_breakdown jsonb`.
- [ ] Server-side validation: recompute score from rounds + workout (anti-tamper baseline).
- [ ] API types aligned with `ScoreBreakdown`.
- [ ] Leaderboard sort: `finalScore` desc, then tie-breaker.
- [ ] Backfill strategy for existing sessions (null vs skip).

#### Planning questions

- Can joiners edit score after submit, or is Honesty Lock one-way?
- Tie-breaker order: higher base score, lower P.V.I., earlier finish?

#### Out of scope

- Ghost, segmented board tabs, honesty lock copy (Phase 5–7).

---

### Phase 5 — Segmented Leaderboards

**Planning goal:** Give tacticians equal glory via distinct ranking views.

#### Scope

- **Highest Raw Score** board — sort by `baseScore` (engine).
- **Best P.V.I.** board — sort by lowest P.V.I. among athletes with minimum round threshold.
- Tab or toggle in live session + post-session views.
- Preserve existing participant list UX patterns (`ParticipantsPanel`, roster).

#### Dependencies

- Phase 4 (persisted scores).

#### Deliverables

- [ ] UI: segmented leaderboard tabs or filter chips.
- [ ] Copy: Architect verdict strings per P.V.I. tier (tooltip or result card).
- [ ] Empty states when insufficient data for P.V.I. board.
- [ ] Tests: sort orders for both board types.

#### Planning questions

- Minimum rounds to appear on Best P.V.I. board?
- Show classification badge (Elite / Standard / etc.) on participant row?

#### Out of scope

- Ghost overlay, honesty lock.

---

### Phase 6 — Honesty Lock

**Planning goal:** Reduce rep-shaving via a deliberate integrity barrier at score submission.

#### Scope

- Final prompt before score commit: *"I logged these reps with absolute integrity and full range of motion."*
- Primary action label: **"I Earned This."** (not generic "Save").
- Optional: require checkbox acknowledgment; block submit until checked.
- Apply to session finish / score finalization flow only.

#### Dependencies

- Phase 4 (score submission path exists).

#### Deliverables

- [ ] Modal or inline confirmation step in finish flow.
- [ ] Copy review (tone: firm, not preachy).
- [ ] Analytics hook optional: `integrity_ack_at` timestamp.
- [ ] Tests: cannot submit without acknowledgment.

#### Planning questions

- Host vs joiner — same flow for both?
- Re-open score edit after "I Earned This"?

#### Out of scope

- Video verification, peer review, external judges.

---

### Phase 7 — Ghost Feature

**Planning goal:** Let athletes race a prior best or a friend's pace minute-by-minute.

#### Scope

- Select ghost source: **personal best** or **friend's session** (same workout + duration).
- Build time-indexed curve from ghost's round logs (elapsed → cumulative reps).
- Live UI: ghost position at current elapsed time (e.g. "Ghost was at 142 reps at 8:00").
- Optional: ghost ahead/behind delta on timer overlay.

#### Dependencies

- Phase 4 (historical scores + round logs queryable).
- Phase 1 (rep curve derivable from rounds + partial).

#### Deliverables

- [ ] Query: fetch ghost session by user + workout fingerprint + duration.
- [ ] Pure function: `buildGhostRepCurve(rounds, repsPerRound, partialReps)`.
- [ ] Pure function: `ghostRepsAtElapsed(curve, elapsedSec)`.
- [ ] UI: ghost picker + in-session comparison strip or chart.
- [ ] Tests: interpolation between round boundaries.

#### Planning questions

- Match ghost by workout template id, workout JSON hash, or movement list?
- Ghost for live multi-player sessions or solo retrospective only initially?

#### Out of scope

- Real-time ghost of another live athlete (future).

---

## Phase Dependency Graph

```
Phase 1 (Base Engine)
    ↓
Phase 2 (P.V.I.)
    ↓
Phase 3 (Domain Scaling)
    ↓
Phase 4 (Persistence & API)
    ↓
    ├── Phase 5 (Segmented Leaderboards)
    ├── Phase 6 (Honesty Lock)
    └── Phase 7 (Ghost)
```

Phases 5, 6, and 7 can proceed in parallel after Phase 4.

---

## Suggested Pure-Function Module Layout

```
src/lib/scoring/
  computeBaseScore.ts
  computePvi.ts
  getPviMultiplier.ts
  getDomainWeight.ts
  computeFinalScore.ts
  buildGhostRepCurve.ts
  types.ts
  *.test.ts
```

Align with existing `src/lib/sessionSync/computeParticipantSplits.ts` — splits feed P.V.I.; do not duplicate duration math.

---

## Success Metrics

| Metric | Target |
| --- | --- |
| Score reproducibility | Same rounds + workout → identical score server-side and client-side |
| P.V.I. sanity | Synthetic evenly-paced rounds → P.V.I. ≈ 0%, Elite tier |
| Leaderboard clarity | Users can explain why they ranked below a peer (breakdown visible) |
| Integrity UX | Honesty Lock shown on 100% of score submissions |

---

## References

- Round splits: `src/lib/sessionSync/computeParticipantSplits.ts`
- Live leaderboard: `src/lib/realtime/sessionChannelUtils.ts` → `buildLeaderboard()`
- Workout parsing: `src/lib/workout/parseWorkoutLines.ts`, `src/data/workoutTemplates.ts`
- Time domains: `5 | 10 | 15 | 20` in `workoutTemplates.ts`
