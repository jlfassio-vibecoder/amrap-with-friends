import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { HostScheduledMissionsPanel } from '@/components/mission/HostScheduledMissionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { resumeMissionIdentity } from '@/lib/api/resumeMissionIdentity';
import {
  isMissionIdUuid,
  joinMission,
  mapDeepLinkJoinError,
  MISSION_LOCKED_OR_INVALID,
} from '@/lib/api/missions';
import {
  isRallyPointIdUuid,
  joinRallyPoint,
  isLiveRallyPointMissionState,
} from '@/lib/api/rallyPoint';
import { callsignFromEmail } from '@/lib/missionIdentity';
import { getSupabaseConfigError } from '@/lib/supabase';
import { unlockTacticalAudio } from '@/lib/audio/tacticalSynthesis';
import { track } from '@/lib/analytics/track';

export default function JoinMissionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rallyParam = params.get('m');
  const rallyPointParam = params.get('r');
  const rallyPointDeepLink = rallyPointParam !== null;
  const rallyDeepLink = rallyParam !== null && !rallyPointDeepLink;
  const deepLink = rallyDeepLink || rallyPointDeepLink;
  const rallyMissionId = rallyParam?.trim() ?? '';
  const rallyPointId = rallyPointParam?.trim() ?? '';
  const rallyUuidValid = rallyDeepLink && isMissionIdUuid(rallyMissionId);
  const rallyPointUuidValid = rallyPointDeepLink && isRallyPointIdUuid(rallyPointId);

  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const authCallsign = callsignFromEmail(user?.email);
  const canAutoJoinMission = rallyDeepLink && rallyUuidValid && isAuthenticated && !!authCallsign;
  const canAutoJoinRallyPoint =
    rallyPointDeepLink && rallyPointUuidValid && isAuthenticated && !!authCallsign;

  const [missionId, setMissionId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(
    (rallyDeepLink && !rallyUuidValid) || (rallyPointDeepLink && !rallyPointUuidValid)
      ? MISSION_LOCKED_OR_INVALID
      : null
  );
  const [loading, setLoading] = useState(false);
  const autoJoinedMissionIdRef = useRef<string | null>(null);
  const autoJoinedRallyPointIdRef = useRef<string | null>(null);

  async function performRallyPointJoin(targetRallyPointId: string, callsign: string) {
    setError(null);
    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }
    setLoading(true);
    try {
      const result = await joinRallyPoint({ rallyPointId: targetRallyPointId, nickname: callsign });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data?.missionId && isLiveRallyPointMissionState(result.data.missionState)) {
        navigate(`/mission/${result.data.missionId}`);
        return;
      }
      navigate(`/rally-point/${targetRallyPointId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function performJoin(targetMissionId: string, callsign: string, deep: boolean) {
    setError(null);

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    setLoading(true);
    try {
      // Authenticated reclaim first: Featured WOD / prior claim already has a
      // participants row with user_id — avoid inserting a duplicate joiner.
      if (isAuthenticated) {
        const resumed = await resumeMissionIdentity(targetMissionId.trim());
        if (resumed.data) {
          track(
            'mission_joined',
            { deep_link: deep, auth: true, resumed: true },
            {
              userId: user?.id ?? null,
              missionId: targetMissionId.trim(),
              participantId: resumed.data.participantId,
            }
          );
          navigate(`/mission/${targetMissionId.trim()}`);
          return;
        }
        if (resumed.error) {
          setError(deep ? mapDeepLinkJoinError(resumed.error.message) : resumed.error.message);
          return;
        }
      }

      const result = await joinMission({
        missionId: targetMissionId,
        nickname: callsign,
      });

      if (result.error) {
        setError(deep ? mapDeepLinkJoinError(result.error.message) : result.error.message);
        return;
      }

      if (result.data) {
        track(
          'mission_joined',
          {
            deep_link: deep,
            auth: isAuthenticated,
            resumed: false,
            role: result.data.role,
          },
          {
            userId: user?.id ?? null,
            missionId: targetMissionId.trim(),
            participantId: result.data.participantId,
          }
        );
        navigate(`/mission/${targetMissionId.trim()}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(deep ? mapDeepLinkJoinError(message) : message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAutoJoinMission || isAuthLoading || !authCallsign) {
      return;
    }
    if (autoJoinedMissionIdRef.current === rallyMissionId) {
      return;
    }
    autoJoinedMissionIdRef.current = rallyMissionId;
    void performJoin(rallyMissionId, authCallsign, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-join per rally mission id
  }, [canAutoJoinMission, isAuthLoading, authCallsign, rallyMissionId]);

  useEffect(() => {
    if (!canAutoJoinRallyPoint || isAuthLoading || !authCallsign) {
      return;
    }
    if (autoJoinedRallyPointIdRef.current === rallyPointId) {
      return;
    }
    autoJoinedRallyPointIdRef.current = rallyPointId;
    void performRallyPointJoin(rallyPointId, authCallsign);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-join per rallyPoint id
  }, [canAutoJoinRallyPoint, isAuthLoading, authCallsign, rallyPointId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    unlockTacticalAudio();
    if (rallyPointDeepLink) {
      if (!rallyPointUuidValid) {
        setError(MISSION_LOCKED_OR_INVALID);
        return;
      }
      await performRallyPointJoin(rallyPointId, nickname || authCallsign || '');
      return;
    }
    if (rallyDeepLink) {
      if (!rallyUuidValid) {
        setError(MISSION_LOCKED_OR_INVALID);
        return;
      }
      await performJoin(rallyMissionId, nickname || authCallsign || '', true);
      return;
    }
    await performJoin(missionId, nickname, false);
  }

  if ((rallyDeepLink && !rallyUuidValid) || (rallyPointDeepLink && !rallyPointUuidValid)) {
    return (
      <NarrowPageLayout title="Join mission" subtitle="You’ve been invited">
        <p className="text-error">{MISSION_LOCKED_OR_INVALID}</p>
        <p className="text-center text-sm">
          <Link className="link-accent" to="/join">
            Enter a mission ID manually
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  if (deepLink && isAuthLoading) {
    return (
      <NarrowPageLayout title="Join mission" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Checking identity…</p>
      </NarrowPageLayout>
    );
  }

  if (deepLink && (canAutoJoinMission || canAutoJoinRallyPoint) && !error) {
    return (
      <NarrowPageLayout title="Join mission" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Welcome, {authCallsign}. Joining…</p>
        {loading ? <p className="text-sm text-secondary">Joining…</p> : null}
      </NarrowPageLayout>
    );
  }

  if (deepLink) {
    return (
      <NarrowPageLayout title="Join mission" subtitle="You’ve been invited">
        <p className="text-sm text-secondary lg:hidden">
          Enter a name to join. No account required.
        </p>
        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">You’ve been invited</h1>
          <p className="text-sm text-secondary">Enter a name to join. No account required.</p>
        </div>

        <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wide">Your name</span>
            <input
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={authCallsign ?? 'Your name'}
              maxLength={50}
              required
              autoFocus
            />
          </label>

          {error ? <p className="text-error">{error}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full uppercase tracking-widest"
            disabled={loading}
          >
            {loading ? 'Joining…' : 'Join mission'}
          </button>
        </form>

        <HostScheduledMissionsPanel />

        <p className="text-center text-sm">
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  return (
    <NarrowPageLayout title="Join mission" subtitle="Enter a mission ID">
      <p className="text-sm text-secondary lg:hidden">Enter the mission ID shared by your host.</p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">Join mission</h1>
        <p className="text-sm text-secondary">Enter the mission ID shared by your host.</p>
      </div>

      <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Mission ID</span>
          <input
            className="input-field"
            value={missionId}
            onChange={(e) => setMissionId(e.target.value)}
            placeholder="Paste mission ID"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Your nickname</span>
          <input
            className="input-field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            maxLength={50}
            required
          />
        </label>

        {error && <p className="text-error">Error: {error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Joining…' : 'Join mission'}
        </button>
      </form>

      <HostScheduledMissionsPanel />

      <p className="text-center text-sm">
        <Link className="link-accent" to="/create">
          Create a new mission
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
