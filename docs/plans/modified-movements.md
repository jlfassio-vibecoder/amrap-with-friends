# Plan: marking a movement as modified

**Branch:** `feature/modified-movements`
**Status:** Phases 1 and 2 shipped — phase 3 (named variants) is next
**Last updated:** 2026-09-08

---

## Verdict in one paragraph

A workout that programmes diamond push-ups is unusable for a lot of people
without dropping to the knees, and today the product has no way to say so. The
score goes on the board as though it were the programmed movement, becomes the
personal best the ghost races next time, and — inside a campaign — becomes the
benchmark a retest is measured against. This adds a per-movement "I modified
this" mark, captured in the partial-reps modal at the end of the mission where
the honesty lock already lives. **It changes what the score is comparable to. It
does not change the intensity tier, the training load, or the score itself**, for
reasons set out below that are the most important part of this document.

---

## What exists today

| Piece                 | State                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaling / RX concept  | **None.** The `STD` badge on the leaderboard is `PacingBadge` — the Standard _pacing_ band. The `scale_cuts` migrations are guest-poll payload size, unrelated. |
| Honesty affordance    | `HonestyLockCheckbox`, already used in `PartialRepsModal` for the partial reps of an unfinished last round                                                      |
| Result write path     | `submit-participant-result` edge function → `participant_segment_results`                                                                                       |
| Ghost / personal best | `available_ghosts(p_template_id, p_duration_minutes)` — best `final_score` on that exact template and clock                                                     |
| Campaign roles        | Derived by `deriveCampaignRoles`; benchmark ids frozen in `campaignBenchmarks.ts` and fingerprinted in CI                                                       |
| Brand precedent       | Tier 3 guided ignition already says "Put me in the Crucible. No modifications."                                                                                 |

---

## The decision that matters: intensity does not change

The obvious design is "modified means one tier easier." It is wrong, and it
would quietly damage two systems that were just repaired.

`intensity_tier` feeds:

1. **Training load** — `duration_minutes × intensity_tier`, which is the acute
   and chronic load behind the overtraining card and the ACWR.
2. **Classification gates** — Operator needs missions at tier 3+, Special Ops at
   tier 4+.

So if the mark drops the tier, then ticking the honest box:

- lowers this week's load **and** the chronic baseline it is measured against,
  making next week's ratio worse — reintroducing the false-positive class of bug
  the overtraining work has just been through;
- costs progress toward Operator and Special Ops.

**An honesty mechanism that penalises honesty gets switched off.** Within a
fortnight people learn not to tick it, and the product loses the data entirely —
which is a worse outcome than never having asked. The mark has to be free to
give.

It is also not obviously right on the physiology. An AMRAP is self-paced: scale a
movement to something you can sustain and you complete **more rounds** at the
same heart rate and the same perceived effort. The effort was the effort. What a
modification changes is not how hard the athlete worked — it is **what the score
can honestly be compared against**.

### What it does change

| Surface                                         | Behaviour                                                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaderboard, My Missions, scorecard             | Result carries a **Modified** badge. Shown, never hidden, never removed — deleting an honest score is the same disincentive wearing a different coat. |
| Ghost / personal best                           | A modified result does **not** become the personal best for the standard movement. `available_ghosts` gains a standard-only filter.                   |
| Campaign benchmark ↔ retest                     | A mismatch between the two is surfaced rather than reported as a plain rep delta. See coupling point 3.                                               |
| Score, PVI, domain weight, load, classification | **Unchanged.**                                                                                                                                        |

---

## Per movement, not per workout

"I did knee diamond push-ups" and "I modified this workout" are different facts,
and only the first one can become a progression later. The mark is stored against
the movement, and the workout is derived as modified when any movement is.

This costs almost nothing now and is the whole foundation of phase 2.

---

## Where it goes

`PartialRepsModal`, under the existing `HonestyLockCheckbox`. That modal is
already the moment before a result is locked, it is already the place the product
asks the athlete to be honest about something, and it is already gated on the
mission being finished.

Sketch:

```
Extra reps in your unfinished round      [ 7 ]
[x] I earned these reps

Did you modify any movement?             (optional)
  [ ] Reverse Lunges (Total)
  [x] Diamond Push-ups
  [ ] Sprawls
Modified movements are marked on your score. They do not lower it.

               [ I EARNED THIS ]
```

That last line is not decoration. If the athlete believes the checkbox costs
points, they will not tick it, and the sentence is the cheapest way to say
otherwise.

---

## Data model

`submit-participant-result` gains one optional field:

```ts
export interface SubmitParticipantResultRequest {
  // …existing
  /** Names of movements the athlete modified, as they appear in the workout. */
  modifiedMovements?: string[];
}
```

Stored on `participant_segment_results` as `modified_movements text[]`, null or
empty meaning "as programmed". A column rather than a key inside
`score_breakdown`: it is not part of the score, and burying it in the scoring
jsonb invites a future change to treat it as one.

Movement **name** rather than index, so the record survives a workout being
edited underneath it, and reads correctly in a badge tooltip without a lookup.

---

## Coupling points that need a decision

### 1. Ghosts and personal bests

`available_ghosts` returns the best `final_score` for a template and clock. A
modified run should not become the ghost an athlete races on their next standard
attempt — that turns a scaled score into a target they cannot reach.

**Recommendation:** filter modified results out of the ghost query. Keep them
visible in My Missions; they are the athlete's own history, just not their
standard-movement best.

**Open:** should a _modified_ run race the athlete's best _modified_ run on the
same template? That is the like-for-like comparison and it is the one that shows
progression. It needs the phase-2 variant names to be meaningful — a generic flag
cannot tell knee push-ups from an incline. Deferred.

### 2. The leaderboard within one mission

Two people in the same mission, one modified, one not. The badge makes the
difference legible without removing anyone from the board.

**Recommendation:** single board, badge on the row. Do not split into Standard
and Modified boards in v1 — with typical squad sizes of two to six, splitting
produces two boards of one and destroys the social point of the feature.

### 3. Campaign benchmark and retest — **needs your call**

A campaign measures a retest against its benchmark. Three cases:

| Benchmark | Retest   | What it means                                                                 |
| --------- | -------- | ----------------------------------------------------------------------------- |
| Standard  | Standard | Clean comparison                                                              |
| Modified  | Modified | Clean comparison, _if_ the modification was the same — which v1 cannot verify |
| Modified  | Standard | **Genuine progress**, and a rep delta alone will understate or invert it      |

The third row is the interesting one and it is exactly the outcome the feature
exists to produce. Reporting "you scored 12 fewer reps" to someone who moved from
knee push-ups to full ones is the product actively discouraging the thing it
wants.

**Decided: (a).**

**Options considered:**

- **(a)** Surface the mismatch as context on the comparison: "Your benchmark was
  modified; this retest was not." Cheap, honest, no maths.
- **(b)** Suppress the numeric delta entirely when the modification state differs
  and show the qualitative change instead.
- **(c)** Attempt an adjusted comparison. **Not recommended** — any correction
  factor would be invented, and this product has already committed to not
  publishing invented numbers.

**Recommendation: (a).** It is one sentence, it cannot be wrong, and it leaves
the athlete to draw the conclusion that is obviously in their favour.

### 4. Guests

Guests have no account and no history, so ghosts and campaigns do not apply. The
badge still shows on the mission leaderboard.

**Recommendation:** available to everyone; nothing extra to build.

### 5. Retro-marking

The mark is captured at lock time. Should an athlete be able to add or remove it
later from My Missions?

**Recommendation:** no in v1. It is a fact about a workout that already happened,
and an editable one invites tidying history. Revisit only if people ask.

---

## Phased delivery

### Phase 1 — Capture and badge — **done**

- Column, edge-function field, and the checklist in `PartialRepsModal`.
- Badge on the scorecard, mission leaderboard and My Missions.
- Pure `isModifiedResult` / badge-presentation helpers in `src/lib/`, tested.
- Explicitly: no change to `computeScoreBreakdown`, `getDomainWeight`,
  `compute_overtraining_load`, or any classification query. A test should assert
  that a modified result and an unmodified one with the same rounds score
  identically — the guarantee is worth pinning, because it is the one a future
  change is most likely to break by accident.

### Phase 2 — Ghost and campaign handling — **done**

- Standard-only filter in `available_ghosts`.
- Benchmark/retest mismatch note per decision 3.

### Phase 3 — Named variants (the feature this is really for)

Choosing "Knee Diamond Push-ups" before the mission rather than flagging
"modified" after it. This is what turns the mark into progression: _40 → 45 → 48
reps on knee push-ups, then the standard movement_ is a story the product can
tell; "not standard" is not.

It needs a variant relationship in the exercise library — a scaling ladder per
movement — which is content work across 69 exercises, not code. Phase 1 and 2 are
deliberately shaped so that the pre-mission picker writes **the same field** the
post-mission checklist writes; two sources of truth for one fact is the failure
mode to avoid.

### Non-goals (v1)

- Any change to score, load, intensity or classification.
- Splitting leaderboards.
- Editing the mark after the fact.
- A scaling ladder in the exercise library.

---

## Integrity note

Marking modified _after_ seeing the score invites rationalising. The risk is
small here precisely **because** there is no scoring penalty — there is nothing
to gain by lying in either direction. This is a further argument against ever
attaching a cost: the moment the mark changes the score, the after-the-fact
timing becomes a real integrity problem and the capture would have to move to
before the mission, which is exactly the friction this design avoids.

---

## Success criteria

- An athlete can mark one movement without leaving the results flow.
- A modified result and an identical unmodified one produce the same final score,
  the same PVI, and the same training load. Asserted in tests.
- A modified result never becomes the ghost for a standard attempt.
- A retest that differs in modification state from its benchmark says so.
- Marking a movement costs nothing, and the UI says as much where the athlete
  decides.

---

## Key files

| Area                | Paths                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Capture             | `src/components/PartialRepsModal.tsx`, `HonestyLockCheckbox.tsx`                                                                 |
| Submit path         | `src/lib/api/missionSync.ts` (`submitParticipantResult`), `supabase/functions/submit-participant-result/handler.ts` + `index.ts` |
| Storage             | `participant_segment_results` (new `modified_movements text[]`)                                                                  |
| Badge               | `src/components/MissionScorecard.tsx`, leaderboard rows, `src/pages/MyMissionsPage.tsx`                                          |
| Ghosts (phase 2)    | `available_ghosts` in `20260824140000_session_template_id_and_ghost_rpcs.sql`                                                    |
| Campaigns (phase 2) | `src/lib/campaign/` comparison surfaces                                                                                          |
| Must not change     | `computeScoreBreakdown.ts`, `getDomainWeight.ts`, `compute_overtraining_load`, classification queries                            |
