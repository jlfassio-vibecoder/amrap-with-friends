import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import type { AthleteProfile } from '@/lib/api/athleteProfile';
import {
  canSetPerceivedClassification,
  type PerceivedClassification,
} from '@/lib/hud/compareClassificationRank';

const RANKS: Array<{ id: PerceivedClassification; label: string }> = [
  { id: 'civilian', label: 'CIVILIAN' },
  { id: 'operator', label: 'OPERATOR' },
  { id: 'special_ops', label: 'SPECIAL OPS' },
];

const DISCLAIMER =
  'Claiming this rank does not grant it. You will be prescribed the required volume and lethality to prove it.';

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/hud';
}

function ageFromBirthYear(birthYear: number, nowYear: number): number {
  return Math.max(13, nowYear - birthYear);
}

interface IntakeFormProps {
  initial: AthleteProfile | null;
  nowYear: number;
  onSave: (input: AthleteProfile) => Promise<{ error: string | null }>;
  onSaved: () => void;
}

function IntakeForm({ initial, nowYear, onSave, onSaved }: IntakeFormProps) {
  const [heightCm, setHeightCm] = useState(
    initial ? String(initial.heightCm) : ''
  );
  const [weightKg, setWeightKg] = useState(
    initial ? String(initial.weightKg) : ''
  );
  const [age, setAge] = useState(
    initial ? String(ageFromBirthYear(initial.birthYear, nowYear)) : ''
  );
  const [rank, setRank] = useState<PerceivedClassification | null>(
    initial?.perceivedClassification ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    const h = Number(heightCm);
    const w = Number(weightKg);
    const a = Number(age);
    return (
      rank !== null &&
      Number.isInteger(h) &&
      h >= 100 &&
      h <= 250 &&
      Number.isFinite(w) &&
      w >= 30 &&
      w <= 250 &&
      Number.isInteger(a) &&
      a >= 13 &&
      a <= 120
    );
  }, [heightCm, weightKg, age, rank]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !rank) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onSave({
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      birthYear: nowYear - Number(age),
      perceivedClassification: rank,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form className="card space-y-6 p-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Height (cm)
          </span>
          <input
            className="input-field tabular-nums"
            inputMode="numeric"
            value={heightCm}
            onChange={(event) => setHeightCm(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Weight (kg)
          </span>
          <input
            className="input-field tabular-nums"
            inputMode="decimal"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Age
          </span>
          <input
            className="input-field tabular-nums"
            inputMode="numeric"
            value={age}
            onChange={(event) => setAge(event.target.value)}
          />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Declaration
        </p>
        <div className="space-y-3">
          {RANKS.map((option) => {
            const disabled = !canSetPerceivedClassification(
              initial?.perceivedClassification ?? null,
              option.id
            );
            const selected = rank === option.id;
            return (
              <div key={option.id} className="space-y-1">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  className={
                    selected
                      ? 'w-full rounded-card bg-accent px-4 py-3 text-left text-sm font-bold uppercase tracking-widest text-on-accent'
                      : disabled
                        ? 'w-full rounded-card border border-border px-4 py-3 text-left text-sm font-bold uppercase tracking-widest text-muted opacity-50'
                        : 'w-full rounded-card border border-border px-4 py-3 text-left text-sm font-bold uppercase tracking-widest text-ink hover:border-accent/40'
                  }
                  onClick={() => setRank(option.id)}
                >
                  {option.label}
                </button>
                {option.id !== 'civilian' ? (
                  <p className="text-xs text-secondary">{DISCLAIMER}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {error ? <p className="text-error">Error: {error}</p> : null}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={!canSubmit || submitting}
      >
        {submitting ? 'Saving…' : 'File the dossier'}
      </button>
    </form>
  );
}

export default function IntakePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { profile, loading, save } = useAthleteProfile();
  const nowYear = new Date().getFullYear();

  if (isAuthLoading || loading) {
    return (
      <NarrowPageLayout title="Intake" subtitle="Dossier">
        <p className="text-sm text-secondary">Loading…</p>
      </NarrowPageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <NarrowPageLayout title="Intake" subtitle="Dossier">
        <p className="text-sm text-secondary">Sign in to complete intake.</p>
        <p className="text-center text-sm">
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  return (
    <NarrowPageLayout title="Intake" subtitle="The dossier">
      <p className="text-sm text-secondary lg:hidden">State the claim. Telemetry decides.</p>
      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">Intake</h1>
        <p className="text-sm text-secondary">State the claim. Telemetry decides.</p>
      </div>

      <IntakeForm
        key={profile ? profile.perceivedClassification : 'new'}
        initial={profile}
        nowYear={nowYear}
        onSave={save}
        onSaved={() => navigate(safeNext(params.get('next')))}
      />
    </NarrowPageLayout>
  );
}
