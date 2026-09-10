-- Tighten mission_chain_items.duration_minutes to legal library caps for
-- databases that already applied the wider BETWEEN 1 AND 60 check.

ALTER TABLE public.mission_chain_items
  DROP CONSTRAINT IF EXISTS mission_chain_items_duration_range;

ALTER TABLE public.mission_chain_items
  ADD CONSTRAINT mission_chain_items_duration_range CHECK (
    duration_minutes BETWEEN 3 AND 5
    OR duration_minutes BETWEEN 7 AND 10
    OR duration_minutes BETWEEN 12 AND 15
    OR duration_minutes BETWEEN 18 AND 25
  );
