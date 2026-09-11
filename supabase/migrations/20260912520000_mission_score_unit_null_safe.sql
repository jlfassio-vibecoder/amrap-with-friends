-- mission_score_unit said "reps" for a movement with no target at all.
--
-- The predicate was:
--
--   WHERE NOT (
--     (e ->> 'target') ~ '^[0-9]+$' AND (e ->> 'target')::bigint > 0 AND ...
--   )
--
-- With no `target` key, `e ->> 'target'` is NULL, `NULL ~ '...'` is NULL, and
-- `NOT NULL` is NULL -- which is not true, so the row does not match, so
-- NOT EXISTS holds and the workout is called rep-counted. A workout nobody can
-- count reps for then prints its round count as reps.
--
-- Three-valued logic, for the fourth time in this feature. `NULL NOT IN (...)`
-- did it three times in the room RPCs and this is the same mistake wearing
-- `NOT (...)` instead. The lesson that keeps not sticking: in a WHERE clause a
-- negated expression over a nullable column needs its own coalesce, because
-- "unknown" is not "true" and is also not "false".
--
-- Caught by enumerating the odd shapes against production rather than the one
-- shape the feature was written for.

CREATE OR REPLACE FUNCTION public.mission_score_unit(p_workout jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_workout) = 'array'
     AND jsonb_array_length(p_workout) > 0
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_workout) e
       -- "not known to be valid" is the condition that disqualifies a
       -- workout, and a missing key is not known to be valid.
       WHERE NOT coalesce(
         (e ->> 'target') ~ '^[0-9]+$'
         AND (e ->> 'target')::bigint > 0
         AND coalesce(e ->> 'unit', 'reps') IN ('reps', 'sec'),
         false
       )
     )
    THEN 'reps'
    ELSE 'rounds'
  END;
$$;

REVOKE ALL ON FUNCTION public.mission_score_unit(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_score_unit(jsonb) TO anon, authenticated;
