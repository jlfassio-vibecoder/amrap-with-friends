-- Phase 1 (mission read scoping): denormalize mission_id onto participant_segment_results
-- so Realtime and bootstrap can filter mission_id=eq.… instead of an unfiltered table listen.

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS mission_id uuid NULL REFERENCES public.missions (id) ON DELETE CASCADE;

UPDATE public.participant_segment_results psr
SET mission_id = p.mission_id
FROM public.participants p
WHERE p.id = psr.participant_id
  AND psr.mission_id IS NULL;

DO $$
DECLARE
  v_orphans int;
BEGIN
  SELECT count(*)::int
  INTO v_orphans
  FROM public.participant_segment_results
  WHERE mission_id IS NULL;

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      'participant_segment_results.mission_id backfill left % orphan row(s)',
      v_orphans;
  END IF;
END $$;

ALTER TABLE public.participant_segment_results
  ALTER COLUMN mission_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participant_segment_results_mission_id
  ON public.participant_segment_results (mission_id);

CREATE OR REPLACE FUNCTION public.set_participant_segment_results_mission_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mission_id uuid;
BEGIN
  SELECT mission_id
  INTO v_mission_id
  FROM public.participants
  WHERE id = NEW.participant_id;

  IF v_mission_id IS NULL THEN
    RAISE EXCEPTION 'Participant not found for segment result';
  END IF;

  NEW.mission_id := v_mission_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participant_segment_results_mission_id
  ON public.participant_segment_results;

CREATE TRIGGER trg_participant_segment_results_mission_id
  BEFORE INSERT OR UPDATE OF participant_id
  ON public.participant_segment_results
  FOR EACH ROW
  EXECUTE FUNCTION public.set_participant_segment_results_mission_id();

GRANT SELECT (mission_id) ON public.participant_segment_results TO anon, authenticated;
