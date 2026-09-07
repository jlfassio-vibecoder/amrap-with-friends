-- Enforce locked_at only when score_breakdown is present.
-- The 180000 trigger preserved NEW.locked_at on unlocked rows, so an admin
-- UPDATE could stamp locked_at without a score. Clear on unlock; stamp only
-- when score_breakdown is non-null; keep immutability once set on a locked row.

CREATE OR REPLACE FUNCTION public.participant_segment_results_set_locked_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Unlocked rows must not carry a lock stamp (blocks admin UPDATE of locked_at alone).
  IF NEW.score_breakdown IS NULL THEN
    NEW.locked_at := NULL;
    RETURN NEW;
  END IF;

  -- Once stamped on a locked row, never move — even if a later UPDATE bumps updated_at.
  IF TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL THEN
    NEW.locked_at := OLD.locked_at;
    RETURN NEW;
  END IF;

  NEW.locked_at := coalesce(NEW.locked_at, now());
  RETURN NEW;
END;
$$;

UPDATE public.participant_segment_results
SET locked_at = NULL
WHERE score_breakdown IS NULL
  AND locked_at IS NOT NULL;
