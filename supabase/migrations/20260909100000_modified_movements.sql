-- Record which movements an athlete performed differently from the programmed
-- version — knee push-ups instead of diamond push-ups, say.
--
-- A column rather than a key inside score_breakdown, deliberately. This is not
-- part of the score and must never become part of it: dropping an intensity tier
-- for an honest disclosure would lower the athlete's chronic training baseline,
-- worsening the next week's acute:chronic ratio, and cost them progress toward
-- Operator. An honesty mechanism that penalises honesty stops being used.
-- Keeping it out of the scoring jsonb makes that boundary structural rather than
-- a matter of policy.
--
-- Null and empty both mean "as programmed". Movement names rather than indices,
-- so a mark still reads correctly if a workout is edited underneath it.

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS modified_movements text[] NULL;

ALTER TABLE public.participant_segment_results
  DROP CONSTRAINT IF EXISTS participant_segment_results_modified_movements_bounds;

ALTER TABLE public.participant_segment_results
  ADD CONSTRAINT participant_segment_results_modified_movements_bounds CHECK (
    modified_movements IS NULL
    OR (
      array_length(modified_movements, 1) IS NULL
      OR array_length(modified_movements, 1) <= 12
    )
  );

-- Signed-in athletes receive membership-scoped postgres_changes on this table,
-- so the column has to be readable the same way the rest of the row is.
GRANT SELECT (modified_movements) ON public.participant_segment_results TO anon, authenticated;
