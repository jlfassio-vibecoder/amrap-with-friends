# Plan: marking a movement as modified

**Branch:** `feature/modified-movements`
**Status:** Phases 1–3 shipped, including the pre-mission picker, the progression
view and the same-variant ghost.
**Last updated:** 2026-09-09

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

It is also not obviously right on the physiology. An AMRAP is self-paced: modify a
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
attempt — that turns a modified score into a target they cannot reach.

**Decided:** filter modified results out of the ghost query. Keep them visible in
My Missions; they are the athlete's own history, just not their standard-movement
best.

**Also decided: the campaign pacer stays unfiltered.** The same function has a
second query that races live teammates on the current occurrence rather than a
stored personal best. Declining to hand an athlete a stale target they cannot
reach is one thing; removing a teammate from a shared workout is another, and a
teammate who modified a movement is still someone to train alongside. This is
settled, not deferred — the migration says so at the call site.

**Also decided, once phase 3 made it possible: yes.** A modified run now races
the athlete's best previous run of the _exact same version_. This was deferred
because a generic "modified" flag cannot tell knee push-ups from an incline; the
named variants and the pre-mission picker between them supply both halves — what
the version is, and the fact that the athlete has said which one they are about
to do.

`available_ghosts` gains `p_version_key`. Empty or absent asks for the standard
best only, exactly as before. A named version additionally returns
`variant_best`: the best scored run whose whole modification state matches.
`personal_best` is unchanged and still standard-only, and both come back
together — an athlete's own standard best is not something to hide from them, it
is just not the like-for-like curve when they have said they are modifying.

The match is on the **whole** modification state, not on the movement asked
about. Modifying the push-ups and modifying the squats instead are two different
workouts, and a ghost built from the wrong one paces wrong. Same rule as the
progression view, and the same key: `versionKeyFor`.

That key now exists in TypeScript and in SQL, which is drift waiting to happen —
and drift here does not raise. The keys simply stop matching, the ghost is
silently absent, and nothing says why. `movementVersion.contract.test.ts` parses
`movement_version_key` out of the migration and runs both over every option in
the library plus the cases a collation would get wrong. The SQL sorts
`COLLATE "C"` and the TypeScript sorts by code point, so the database's own
locale never decides whether a ghost matches.

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

### Phase 3 — Named variants (the feature this is really for) — **done**

Choosing "Knee Diamond Push-ups" before the mission rather than flagging
"modified" after it. This is what turns the mark into progression: _40 → 45 → 48
reps on knee push-ups, then the standard movement_ is a story the product can
tell; "not standard" is not.

**Shipped:** the modification ladder itself (`src/data/exerciseScaling.ts`, covering
all 73 library exercises), and naming the option in the end-of-mission checklist.
Marking a movement now reveals its ladder — "Hands elevated / From the knees /
Partial range" for a push-up — and the choice is stored in `movement_variants`
alongside the existing `modified_movements` mark.

Option ids are frozen for the same reason benchmark ids are: they are stored, so
an id that changes meaning silently rewrites history. A test pins the current set.

**Pre-mission picker** (`PreMissionScalingPicker`, in the rally point under the
workout list): a collapsed "Need to modify a movement?" offering the ladder for
each programmed movement that has one. The choice is a **draft**, held in
`localStorage` per mission _and_ per participant — two people share one propped-up
phone often enough that a device-wide key would put one athlete's modification on
the other's score. It is deliberately not a second write path: the plan seeds
`PartialRepsModal`, the athlete confirms or changes it there, and the result row
that modal writes stays the only record of how the mission was performed. The
draft is cleared the moment the result is submitted.

Only movements with a named ladder appear before the mission. A bare "I modified
this" has no meaning until it has happened; the end-of-mission checklist is still
where any movement can be marked.

**Progression view** (`ScalingProgressionPanel`, on My missions, built on the
pure `movementProgression.ts`): the same workout at the same clock, split by the
exact version performed — "Diamond Push-ups: from the knees — 40 → 45 → 48 reps
(+8 reps)", with "As programmed" listed beside it.

Versions are never merged into one trend. A series is keyed by template, time
cap, and the full modification state, because modifying the push-ups, modifying
the squats instead, and the same workout at a different cap are three different
measurements. A movement marked without a named option is its own version too —
merging it with a named one would claim a like-for-like comparison the data does
not support. Nothing computes a correction between versions, for the same reason
option (c) was rejected above: any factor would be invented. A group only
renders once there are two scored missions on it and at least one of them was
modified, so the panel is invisible to anyone who has never modified a movement.

A decline is reported as a decline. A panel that only ever shows improvement is
not a record.

### Non-goals (v1)

- Any change to score, load, intensity or classification.
- Splitting leaderboards.
- Editing the mark after the fact.
- A modification ladder in the exercise library.

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
- A modified result never becomes the ghost for a standard attempt, and a modified
  attempt can race the athlete's best run of that same modification.
- A retest that differs in modification state from its benchmark says so.
- Marking a movement costs nothing, and the UI says as much where the athlete
  decides.

---

## Key files

| Area                | Paths                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Capture             | `src/components/PartialRepsModal.tsx`, `HonestyLockCheckbox.tsx`                                                                        |
| Pre-mission picker  | `src/components/mission/PreMissionScalingPicker.tsx`, `src/lib/mission/scalingPlan.ts`, `src/pages/MissionWaitingRoomPage.tsx`          |
| Progression view    | `src/components/mission/ScalingProgressionPanel.tsx`, `src/lib/mission/movementProgression.ts`, `src/pages/MyMissionsPage.tsx`          |
| Submit path         | `src/lib/api/missionSync.ts` (`submitParticipantResult`), `supabase/functions/submit-participant-result/handler.ts` + `index.ts`        |
| Storage             | `participant_segment_results` (new `modified_movements text[]`)                                                                         |
| Badge               | `src/components/MissionScorecard.tsx`, leaderboard rows, `src/pages/MyMissionsPage.tsx`                                                 |
| Ghosts (phase 2)    | `available_ghosts` in `20260824140000_session_template_id_and_ghost_rpcs.sql`                                                           |
| Same-variant ghost  | `20260909170000_same_variant_ghost.sql`, `src/lib/mission/movementVersion.ts`, `src/lib/api/ghost.ts`, `src/components/GhostPicker.tsx` |
| Campaigns (phase 2) | `src/lib/campaign/` comparison surfaces                                                                                                 |
| Must not change     | `computeScoreBreakdown.ts`, `getDomainWeight.ts`, `compute_overtraining_load`, classification queries                                   |
