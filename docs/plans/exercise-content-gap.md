# Plan: close the exercise content gap

**Branch:** `claude/amrap-seo-roadmap-xwf1sk` (or a follow-up)
**Status:** Draft for approval
**Last updated:** 2026-09-01

---

## The gap

The 69 published movement pages are the largest block of content on the site and
the thinnest per page. Three things are missing, in order of impact:

| Gap                           | Scale                                         | Why it matters                                                                                                                                                   |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`commonMistakes` is empty** | 72 of 73 entries; only `burpees` is filled in | "Common mistakes doing X" is the exact shape of question people put to an assistant, and it is the one section that makes a movement page more than a definition |
| **No images on the page**     | 73 of 73                                      | The library has photo paths and the bucket has objects, but the static pages never resolve them                                                                  |
| **No video**                  | 73 of 73                                      | `videoUrl` is unset everywhere. Out of scope here — it needs footage that does not exist                                                                         |

The page template **already renders `commonMistakes` whenever the array is
non-empty**, so this is content entry with no engineering attached. Same for
images once the URL resolution exists.

## What is safe to change

`benchmarkFingerprints.ts` freezes the score-affecting shape of benchmark
workouts: duration, category, and each movement's name / reps / unit. It does
**not** cover the exercise library at all. Editing `commonMistakes` cannot
invalidate a recorded result, and CI will confirm that.

Do not touch, in this work: exercise `id`s (they are the page slugs and the
links), `setupAndExecution`, `coachingCue`, `amrapTip`, or anything in
`workoutTemplates.ts`.

---

## Part 1 — Common mistakes

**Decision taken:** Claude drafts, a human reviews before merge. The review has
to be real — this is coaching guidance published under the product's name, and a
wrong cue is worse than a missing one.

### How the drafts get written

Not one at a time. Movements group into families that share failure modes, and
writing per family keeps the mistakes specific and stops the same three
sentences appearing on forty pages:

- Push-up variants (standard, wide, diamond, hand-release, pike, dive-bomber,
  T, sphinx)
- Plank and hold variants (plank, side plank, hollow, superman, bear crawl,
  v-sit, bottom squat)
- Squat and lunge variants (air squat, jump squat, reverse/walking/jumping
  lunges, good mornings)
- Jump and plyometric variants (skater, tuck, broad, pogo, lateral hops,
  double-tap, high knees, butt kicks)
- Burpee family (burpee, half burpee, down-up, sprawl, combat sprawl)
- Midline (sit-up variants, leg raises, flutter kicks, dead bugs, twists,
  bicycle crunches, mountain climbers)
- Glute bridge family
- Everything else, individually

Each entry is drafted from the movement's existing `setupAndExecution` and
`coachingCue`, which usually already imply the failure — the `burpees` entry
("Sagging hips in the plank position", "Skipping the full hip extension on the
jump") is the model to match for voice and specificity.

### The quality bar

Two or three mistakes per movement. Each one must be:

- **Specific to this movement.** "Going too fast" is filler and applies to
  everything. "Cutting the squat above parallel once the legs burn" is a
  mistake.
- **Observable.** Something a coach could see, or an athlete could feel. Not an
  internal state.
- **Not a restatement of the coaching cue.** The cue says what to do; the
  mistake says what people actually do instead.
- **Free of medical or injury claims.** Describe the fault, not a diagnosis or
  a prognosis. No "this will hurt your back".

### Guardrails in CI

Three tests, added with the content:

1. **Every published movement has at least two mistakes.** Tightens
   `hasEnoughToSay` once the content lands, so the bar cannot silently slip
   back.
2. **No mistake string appears on more than one movement.** Catches copy-paste
   across a family, which is the failure mode this approach actually has.
3. **Each mistake is 20–160 characters.** Long enough to be specific, short
   enough to be a bullet.

### The review workflow

Drafts land in `exerciseLibrary.ts` one family per commit, so a reviewer sees
eight to twelve related movements at a time rather than a 72-entry diff. Each
commit body carries the family's mistakes as a table for reading without
scrolling the diff.

**Sequencing:** draft the burpee, push-up and squat families first — those cover
the highest-frequency movements (`air squats` alone appear in 16.7% of workouts,
per `/stats`), so the review effort lands where the traffic will.

---

## Part 2 — Images on movement pages

**Decision taken:** resolve public Supabase Storage URLs at build time.

### The problem with resolving at request time

`getExerciseMediaUrl` needs a browser Supabase client, and the static pages have
no client. The public URL shape is stable
(`{SUPABASE_URL}/storage/v1/object/public/exercise-media/{path}`), so it can be
built directly — but the library stores `{id}/sequence.jpeg` by convention and
the app tries `.jpeg`, `.png` and `.jpg` in turn on load failure. A static page
cannot do that fallback, so guessing the extension ships broken images.

### The design: a committed manifest

Add `npm run seo:resolve-exercise-media`, which probes the bucket once for each
candidate extension and writes `src/data/exerciseMediaManifest.ts` — a plain map
of exercise id to the path that actually exists, plus its alt text.

- **Builds stay deterministic and offline.** CI and Vercel read the committed
  manifest; they never call Supabase.
- **A missing object is visible.** An id absent from the manifest renders no
  image rather than a broken one, and the script reports what it could not find.
- **Re-runnable.** Someone uploads new media, runs the script, commits the diff.

`getExerciseMediaUrl` keeps working unchanged for the app; the manifest is the
static layer's equivalent, and both build the same URL shape.

### Alt text

Derived from the movement name and the photo's `caption` when it has one —
"Burpees: the sequence from squat to full extension" rather than "Burpees".
Never empty, since these images carry instructional content.

### Verification

- `merge-build.ts` fails if a manifest entry points at a URL the pages reference
  but the manifest does not contain.
- A test asserts every manifest entry has non-empty alt text.
- Spot-check a rendered page against the live bucket before merge — this
  sandbox cannot reach Supabase, so the probe has to run somewhere with network.

---

## Part 3 — What this does not cover

- **Video.** No footage exists. Out of scope until it does.
- **Widening the workout pages past 20.** Waiting on real GSC data, per Phase 3.
- **The four movements that fail `hasEnoughToSay`.** They will pass once their
  mistakes are written; the gate then admits them and the page count rises from
  69 to 73 on its own.

---

## Sequencing

1. Part 2 first — it is one script, one manifest and one template change, and it
   improves all 69 pages at once with no review burden.
2. Then Part 1, family by family, highest-frequency movements first.
3. Tighten `hasEnoughToSay` to require two mistakes once every family has
   landed, and confirm the published count goes 69 → 73.

## Open question

Whether these belong on the branch that is already carrying Phases 0–3, or a
fresh one. The SEO branch is large; splitting keeps the content review separate
from the infrastructure review, which is probably worth the extra branch.
