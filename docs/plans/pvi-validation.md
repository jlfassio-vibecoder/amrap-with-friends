# Plan: validating the Pace Variance Index

**Branch:** `claude/amrap-science-hub`
**Status:** Draft for approval
**Last updated:** 2026-09-05
**Answers:** the limitation published on [/science/pacing](../../site/pages/science/pacing.astro)

---

## The short answer

**Yes, and the app already stores everything needed.** Round splits are
reconstructible from `rounds.elapsed_sec_at_round`, and
`participant_session_results.score_breakdown` already persists `pvi`,
`pviMultiplier`, `baseScore` and `finalScore` separately. Nothing new needs
capturing. What is missing is volume and the analysis.

There are three fixes, and they get progressively harder. The first removes most
of the criticism and needs no outcome data at all.

---

## The trap to avoid first

`computeFinalScore` is `baseScore × pviMultiplier × domainWeight`. **PVI already
multiplies the final score**, by 0.85 to 1.15.

So "does PVI predict the final score" is partly tautological — a better PVI
mechanically produces a better final score whether or not pacing did anything.
Any validation must use **`baseScore`** (rounds and reps completed), which is
stored independently and is untouched by the multiplier.

Getting this wrong would produce a strong, published, meaningless result. It is
the single most likely way this analysis goes wrong.

---

## Fix 1 — derive the bands from the observed distribution

**Needs:** a few hundred finished missions with PVI. **No outcome data at all.**

Today the bands are round numbers picked by feel: 10, 20, 30. Replace them with
quantiles of the PVI actually observed across missions — for example the top
decile becomes "Elite pacing", the next quartile "Standard", and so on.

That converts the claim from _"under 10% is elite"_ — an assertion — into
_"you paced this more evenly than 90% of recorded missions"_, which is simply
true and checkable. It is a descriptive statistic about our own population, and
descriptive statistics need no theory to be honest.

Cheap, fast, and it retires most of the objection on the page. Cut the
distribution by time domain: a 5-minute mission and a 20-minute mission almost
certainly do not share a spread, and pooling them would hide that.

## Fix 2 — test whether PVI relates to work done

**Needs:** repeated attempts at the same workout by the same athlete.

The clean design is **within-athlete, within-workout**: same person, same
movements, same time cap, two or more attempts. Does the attempt with the lower
PVI produce the higher `baseScore`?

Holding athlete and workout constant removes the two largest confounds — fitness
and workout difficulty — without needing a big sample or a control group. It is
the comparison the pacing literature cannot easily run and we can.

**Campaigns already generate this structure automatically.** A campaign opens
with a benchmark and retests the identical workout later, deliberately keeping
that workout out of the training rotation. Every completed campaign is a
matched pair. That is a genuine research asset nobody else in this space has,
and it exists as a side effect of a product decision made for other reasons.

Report an effect size and an interval, not a p-value alone, and pre-register the
analysis in the repo before running it so the specification cannot drift toward
the answer we would prefer.

## Fix 3 — publish it, including if it goes against us

**Needs:** fix 2 to have run.

The page already commits to this. Worth being concrete about what a negative
result obliges:

> **If PVI does not relate to work done, the multiplier should stop changing the
> score.**

A metric that alters an athlete's score has to earn that power. Keeping the
multiplier after evidence that it measures nothing would be the same failure as
the "Peer Review Verified" badge that started this whole section — a claim to
authority the evidence does not support.

Fixes 1 and 2 are analysis. Fix 3 is a product decision, and it is the one that
makes the other two worth trusting.

---

## Two threats to the data

**Behavioural contamination.** Because PVI visibly changes the score, athletes
can learn to game it — sandbagging early rounds to flatten the spread. The
cleanest evidence therefore comes from missions recorded _before_ athletes
understood the mechanic, which argues for running fix 1 sooner rather than later
and timestamping the analysis window.

**Missed-round reconstruction.** `rounds.missed_log_reps` marks splits that were
reconstructed rather than logged live. Those rows have a different error profile
and should be excluded from the validation set, or analysed separately. The
field exists precisely so this is possible — a good decision, made before anyone
knew it would matter here.

---

## Precondition

None of this is worth running on the current volume. The honest trigger is a few
hundred finished missions for fix 1, and enough completed campaigns to give a
meaningful number of matched pairs for fix 2. Until then the page says the
thresholds are ours and unvalidated, which is true and stays.

## Also corrected

While tracing the code for this plan, the published claim that "the first round
is excluded" turned out to be wrong. `shouldExcludeBuyInRound` is
`durationMinutes >= 10`, so the exclusion applies only to missions of ten minutes
or longer; on a 5-minute mission every round counts. Both `/science/pacing` and
`/guides/amrap-pacing` have been corrected to state the actual rule.
