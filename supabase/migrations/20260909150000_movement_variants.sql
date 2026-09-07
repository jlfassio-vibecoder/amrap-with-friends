-- Record *how* a movement was modified, not only that it was.
--
-- modified_movements already answers "was this movement performed as
-- programmed?" and stays the single answer to that question. This column hangs
-- the detail off it: { "Diamond Push-ups": "push-up--knees" }, keyed by the same
-- programmed movement name.
--
-- The distinction matters for what the athlete gets back. "Modified" can only
-- ever tell them they were not standard. "Knee push-ups: 40 → 45 → 48 reps" is a
-- progression, and progressing off the scaling is the point of offering it.
--
-- Option ids are frozen in src/data/exerciseScaling.ts for the same reason
-- benchmark ids are: they are stored here, so an id that changes meaning
-- silently rewrites history. An id this build does not recognise resolves to
-- nothing and the plain Modified badge shows instead.

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS movement_variants jsonb NULL;

ALTER TABLE public.participant_segment_results
  DROP CONSTRAINT IF EXISTS participant_segment_results_movement_variants_shape;

ALTER TABLE public.participant_segment_results
  ADD CONSTRAINT participant_segment_results_movement_variants_shape CHECK (
    movement_variants IS NULL
    OR (jsonb_typeof(movement_variants) = 'object' AND length(movement_variants::text) <= 2000)
  );

GRANT SELECT (movement_variants) ON public.participant_segment_results TO anon, authenticated;
