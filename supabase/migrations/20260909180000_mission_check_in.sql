-- Optional post-mission check-in: RPE, structured chips, free-text notes.
--
-- Same honesty rule as modified_movements: free to give, never part of the
-- score. Option ids are frozen in src/data/missionCheckIn.ts.

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS rpe smallint NULL;

ALTER TABLE public.participant_segment_results
  DROP CONSTRAINT IF EXISTS participant_segment_results_rpe_range;

ALTER TABLE public.participant_segment_results
  ADD CONSTRAINT participant_segment_results_rpe_range CHECK (
    rpe IS NULL OR (rpe >= 1 AND rpe <= 10)
  );

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS session_notes text NULL;

ALTER TABLE public.participant_segment_results
  DROP CONSTRAINT IF EXISTS participant_segment_results_session_notes_length;

ALTER TABLE public.participant_segment_results
  ADD CONSTRAINT participant_segment_results_session_notes_length CHECK (
    session_notes IS NULL OR char_length(session_notes) <= 280
  );

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS check_ins jsonb NULL;

ALTER TABLE public.participant_segment_results
  DROP CONSTRAINT IF EXISTS participant_segment_results_check_ins_shape;

ALTER TABLE public.participant_segment_results
  ADD CONSTRAINT participant_segment_results_check_ins_shape CHECK (
    check_ins IS NULL
    OR (jsonb_typeof(check_ins) = 'object' AND length(check_ins::text) <= 500)
  );

GRANT SELECT (rpe) ON public.participant_segment_results TO anon, authenticated;
GRANT SELECT (session_notes) ON public.participant_segment_results TO anon, authenticated;
GRANT SELECT (check_ins) ON public.participant_segment_results TO anon, authenticated;
