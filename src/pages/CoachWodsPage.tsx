import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CoachExerciseLibrary } from '@/components/coachWod/CoachExerciseLibrary';
import { CoachWorkoutForm } from '@/components/coachWod/CoachWorkoutForm';
import { CoachWorkoutList } from '@/components/coachWod/CoachWorkoutList';
import { fetchCoachWorkout, type CoachWorkout, type CoachWorkoutSummary } from '@/lib/api/coachWod';

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; workout: CoachWorkout };

export default function CoachWodsPage() {
  const [view, setView] = useState<View>({ mode: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleSelect(summary: CoachWorkoutSummary) {
    setLoadError(null);
    const result = await fetchCoachWorkout(summary.id);
    if (result.error || !result.data) {
      setLoadError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setView({ mode: 'edit', workout: result.data });
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
    setView({ mode: 'list' });
  }

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="WOD Builder" subtitle="Coach workouts" />

      <div className="mx-auto max-w-4xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        {loadError ? <p className="text-error text-sm">{loadError}</p> : null}

        {view.mode === 'list' ? (
          <>
            <CoachWorkoutList
              refreshKey={refreshKey}
              onSelect={(summary) => {
                void handleSelect(summary);
              }}
              onCreateNew={() => setView({ mode: 'new' })}
            />
            <CoachExerciseLibrary />
          </>
        ) : (
          <CoachWorkoutForm
            workout={view.mode === 'edit' ? view.workout : null}
            onSaved={handleSaved}
            onCancel={() => setView({ mode: 'list' })}
          />
        )}

        <p className="flex justify-center">
          <Link className="link-accent text-sm" to="/coach">
            Back to Coach dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
