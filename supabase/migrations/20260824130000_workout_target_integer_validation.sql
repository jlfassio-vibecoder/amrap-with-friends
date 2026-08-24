-- Reject fractional workout targets so server scoring matches client Number.isInteger checks.

CREATE OR REPLACE FUNCTION public.validate_workout(p_workout jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_name text;
  v_target numeric;
  v_unit text;
  i int;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_workout);
  IF v_len < 1 OR v_len > 20 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_workout -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_name := trim(both from v_elem ->> 'name');
    IF v_name IS NULL OR v_name = '' OR length(v_name) > 120 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'target' THEN
      BEGIN
        v_target := (v_elem ->> 'target')::numeric;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;
      IF v_target IS NULL OR v_target <= 0 OR v_target <> trunc(v_target) THEN
        RETURN false;
      END IF;
    END IF;

    IF v_elem ? 'unit' THEN
      v_unit := v_elem ->> 'unit';
      IF v_unit IS NULL OR length(v_unit) > 32 THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_reps_per_round(p_workout jsonb)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_target numeric;
  v_unit text;
  v_total int := 0;
  i int;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' THEN
    RAISE EXCEPTION 'Invalid workout';
  END IF;

  v_len := jsonb_array_length(p_workout);
  IF v_len < 1 THEN
    RAISE EXCEPTION 'Invalid workout';
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_workout -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Invalid workout';
    END IF;

    IF NOT (v_elem ? 'target') OR jsonb_typeof(v_elem -> 'target') <> 'number' THEN
      RAISE EXCEPTION 'Invalid workout movement target';
    END IF;

    v_target := (v_elem ->> 'target')::numeric;
    IF v_target IS NULL OR v_target <= 0 OR v_target <> trunc(v_target) THEN
      RAISE EXCEPTION 'Invalid workout movement target';
    END IF;

    v_unit := lower(coalesce(v_elem ->> 'unit', 'reps'));
    IF v_unit NOT IN ('reps', 'sec') THEN
      RAISE EXCEPTION 'Unsupported workout movement unit';
    END IF;

    v_total := v_total + v_target::int;
  END LOOP;

  RETURN v_total;
END;
$$;
