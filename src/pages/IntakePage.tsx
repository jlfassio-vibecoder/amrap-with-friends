import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { track, trackBeacon } from '@/lib/analytics/track';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import type { AthleteProfile } from '@/lib/api/athleteProfile';
import type { BiologicalSex } from '@/lib/hud/classificationQuotas';
import {
  canSetPerceivedClassification,
  type PerceivedClassification,
} from '@/lib/hud/compareClassificationRank';
import {
  cmToIn,
  inToCm,
  isValidHeight,
  isValidWeight,
  kgToLb,
  lbToKg,
  type BodyMetricUnitSystem,
} from '@/lib/units/bodyMetrics';

const RANKS: Array<{ id: PerceivedClassification; label: string }> = [
  { id: 'civilian', label: 'CIVILIAN' },
  { id: 'operator', label: 'OPERATOR' },
  { id: 'special_ops', label: 'SPECIAL OPS' },
];

const DISCLAIMER =
  'Claiming this rank does not grant it. You will be prescribed the required volume and lethality to prove it.';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/hud';
}

function ageFromBirthYear(birthYear: number, nowYear: number): number {
  return Math.max(13, nowYear - birthYear);
}

function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

function isValidNickname(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

function convertHeightField(
  raw: string,
  from: BodyMetricUnitSystem,
  to: BodyMetricUnitSystem
): string {
  if (from === to || raw.trim() === '') {
    return raw;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return '';
  }
  if (from === 'imperial' && to === 'metric') {
    return String(inToCm(n));
  }
  return String(cmToIn(n));
}

function convertWeightField(
  raw: string,
  from: BodyMetricUnitSystem,
  to: BodyMetricUnitSystem
): string {
  if (from === to || raw.trim() === '') {
    return raw;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return '';
  }
  if (from === 'imperial' && to === 'metric') {
    return String(lbToKg(n));
  }
  return String(kgToLb(n));
}

interface IntakeFormProps {
  initial: AthleteProfile | null;
  initialEmail: string;
  nowYear: number;
  onSaveProfile: (input: AthleteProfile) => Promise<{ error: string | null }>;
  onUpdateEmail: (
    email: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  onUpdatePassword: (password: string) => Promise<{ error: string | null }>;
  onSaved: () => void;
}

function IntakeForm({
  initial,
  initialEmail,
  nowYear,
  onSaveProfile,
  onUpdateEmail,
  onUpdatePassword,
  onSaved,
}: IntakeFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [unitSystem, setUnitSystem] = useState<BodyMetricUnitSystem>(() => {
    if (!initial) {
      return 'imperial';
    }
    const inches = cmToIn(initial.heightCm);
    const pounds = kgToLb(initial.weightKg);
    // Prefer imperial unless converted values fall outside persistable bounds.
    if (isValidHeight(inches, 'imperial') && isValidWeight(pounds, 'imperial')) {
      return 'imperial';
    }
    return 'metric';
  });
  const [height, setHeight] = useState(() => {
    if (!initial) {
      return '';
    }
    const inches = cmToIn(initial.heightCm);
    const pounds = kgToLb(initial.weightKg);
    const preferImperial =
      isValidHeight(inches, 'imperial') && isValidWeight(pounds, 'imperial');
    return String(preferImperial ? inches : initial.heightCm);
  });
  const [weight, setWeight] = useState(() => {
    if (!initial) {
      return '';
    }
    const inches = cmToIn(initial.heightCm);
    const pounds = kgToLb(initial.weightKg);
    const preferImperial =
      isValidHeight(inches, 'imperial') && isValidWeight(pounds, 'imperial');
    return String(preferImperial ? pounds : initial.weightKg);
  });
  const [age, setAge] = useState(
    initial ? String(ageFromBirthYear(initial.birthYear, nowYear)) : ''
  );
  const [rank, setRank] = useState<PerceivedClassification | null>(
    initial?.perceivedClassification ?? null
  );
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(
    initial?.biologicalSex ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [emailConfirmNotice, setEmailConfirmNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  function markDirty() {
    dirtyRef.current = true;
  }

  useEffect(() => {
    function handleAbandon() {
      if (submittedRef.current || !dirtyRef.current) {
        return;
      }
      trackBeacon('intake_abandoned', { is_first_time: initial === null });
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        handleAbandon();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleAbandon);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleAbandon);
      handleAbandon();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one abandonment listener per form mount
  }, []);

  const heightLabel = unitSystem === 'imperial' ? 'Height (in)' : 'Height (cm)';
  const weightLabel = unitSystem === 'imperial' ? 'Weight (lb)' : 'Weight (kg)';

  const canSubmit = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    const a = Number(age);
    return (
      email.trim().length > 0 &&
      isValidUsername(username) &&
      isValidNickname(nickname) &&
      rank !== null &&
      biologicalSex !== null &&
      isValidHeight(h, unitSystem) &&
      isValidWeight(w, unitSystem) &&
      Number.isInteger(a) &&
      a >= 13 &&
      a <= 120
    );
  }, [email, username, nickname, height, weight, age, rank, biologicalSex, unitSystem]);

  function switchUnitSystem(next: BodyMetricUnitSystem) {
    if (next === unitSystem) {
      return;
    }
    setHeight((prev) => convertHeightField(prev, unitSystem, next));
    setWeight((prev) => convertWeightField(prev, unitSystem, next));
    setUnitSystem(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !rank || !biologicalSex) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setEmailConfirmNotice(null);
    try {
      const heightValue = Number(height);
      const weightValue = Number(weight);
      const heightCm =
        unitSystem === 'imperial' ? inToCm(heightValue) : heightValue;
      const weightKg =
        unitSystem === 'imperial' ? lbToKg(weightValue) : weightValue;
      const profileResult = await onSaveProfile({
        heightCm,
        weightKg,
        birthYear: nowYear - Number(age),
        biologicalSex,
        perceivedClassification: rank,
        username: username.trim(),
        nickname: nickname.trim(),
      });
      if (profileResult.error) {
        setError(profileResult.error);
        return;
      }

      submittedRef.current = true;
      track('intake_submitted', {
        is_first_time: initial === null,
        perceived_classification: rank,
        biological_sex: biologicalSex,
        unit_system: unitSystem,
      });

      const trimmedEmail = email.trim();
      let needsEmailConfirmation = false;
      if (trimmedEmail.toLowerCase() !== initialEmail.trim().toLowerCase()) {
        const emailResult = await onUpdateEmail(trimmedEmail);
        if (emailResult.error) {
          setError(emailResult.error);
          return;
        }
        needsEmailConfirmation = emailResult.needsEmailConfirmation;
      }

      if (password.length > 0) {
        const passwordResult = await onUpdatePassword(password);
        if (passwordResult.error) {
          setError(passwordResult.error);
          return;
        }
      }

      if (needsEmailConfirmation) {
        setEmailConfirmNotice(
          'Dossier filed. Check your inbox to confirm the new email address.'
        );
        return;
      }
      onSaved();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (emailConfirmNotice) {
    return (
      <div className="card space-y-4 p-6">
        <p className="text-sm text-secondary">{emailConfirmNotice}</p>
        <button type="button" className="btn-primary w-full" onClick={onSaved}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <form className="card space-y-6 p-6" onSubmit={handleSubmit}>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Account
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Email
          </span>
          <input
            className="input-field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); markDirty(); }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Password
          </span>
          <input
            className="input-field"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
            value={password}
            onChange={(event) => { setPassword(event.target.value); markDirty(); }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Username
          </span>
          <input
            className="input-field"
            autoComplete="username"
            value={username}
            onChange={(event) => { setUsername(event.target.value); markDirty(); }}
          />
        </label>
        <p className="text-xs text-muted">
          3–30 characters: letters, numbers, underscore
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Nickname
          </span>
          <input
            className="input-field"
            value={nickname}
            onChange={(event) => { setNickname(event.target.value); markDirty(); }}
          />
        </label>
        <p className="text-xs text-muted">
          Default workout callsign (max 50 characters)
        </p>
      </div>

      <div
        className="flex gap-2"
        role="group"
        aria-label="Measurement units"
      >
        <button
          type="button"
          aria-pressed={unitSystem === 'imperial'}
          className={
            unitSystem === 'imperial'
              ? 'rounded-card bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-on-accent'
              : 'rounded-card border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink hover:border-accent/40'
          }
          onClick={() => switchUnitSystem('imperial')}
        >
          in / lb
        </button>
        <button
          type="button"
          aria-pressed={unitSystem === 'metric'}
          className={
            unitSystem === 'metric'
              ? 'rounded-card bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-on-accent'
              : 'rounded-card border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink hover:border-accent/40'
          }
          onClick={() => switchUnitSystem('metric')}
        >
          cm / kg
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {heightLabel}
          </span>
          <input
            className="input-field tabular-nums"
            inputMode="numeric"
            value={height}
            onChange={(event) => { setHeight(event.target.value); markDirty(); }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {weightLabel}
          </span>
          <input
            className="input-field tabular-nums"
            inputMode="decimal"
            value={weight}
            onChange={(event) => { setWeight(event.target.value); markDirty(); }}
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
            onChange={(event) => { setAge(event.target.value); markDirty(); }}
          />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Biological sex
        </p>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Biological sex">
          {(
            [
              { id: 'M' as const, label: 'Male' },
              { id: 'F' as const, label: 'Female' },
            ] as const
          ).map((option) => {
            const selected = biologicalSex === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? 'rounded-card bg-accent px-4 py-3 text-sm font-bold uppercase tracking-widest text-on-accent'
                    : 'rounded-card border border-border px-4 py-3 text-sm font-bold uppercase tracking-widest text-ink hover:border-accent/40'
                }
                onClick={() => { setBiologicalSex(option.id); markDirty(); }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
                  onClick={() => { setRank(option.id); markDirty(); }}
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
  const { isAuthenticated, isAuthLoading, user, updateEmail, updatePassword } =
    useAmrapAuth();
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
        key={profile ? `${profile.perceivedClassification}:${profile.username}` : 'new'}
        initial={profile}
        initialEmail={user?.email ?? ''}
        nowYear={nowYear}
        onSaveProfile={save}
        onUpdateEmail={updateEmail}
        onUpdatePassword={updatePassword}
        onSaved={() => navigate(safeNext(params.get('next')))}
      />
    </NarrowPageLayout>
  );
}
