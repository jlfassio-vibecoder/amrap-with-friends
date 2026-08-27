-- Constrain coach-exercise-media writes to the caller's own folder
-- ({auth.uid()}/...), matching uploadCoachExerciseImage path layout.
-- Replaces the coach-wide INSERT/UPDATE/DELETE policies from
-- 20260829090000_coach_wod_builder.sql.

DROP POLICY IF EXISTS coach_exercise_media_insert ON storage.objects;
DROP POLICY IF EXISTS coach_exercise_media_update ON storage.objects;
DROP POLICY IF EXISTS coach_exercise_media_delete ON storage.objects;

CREATE POLICY coach_exercise_media_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'coach-exercise-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY coach_exercise_media_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'coach-exercise-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coach-exercise-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY coach_exercise_media_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'coach-exercise-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
