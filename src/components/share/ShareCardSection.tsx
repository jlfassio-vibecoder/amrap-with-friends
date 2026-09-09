import { useEffect, useState } from 'react';
import { ShareCardPanel } from '@/components/share/ShareCardPanel';
import {
  getStoredClaimToken,
  getStoredHostToken,
  getStoredParticipantId,
} from '@/lib/missionIdentity';
import { fetchReplayData } from '@/lib/share/replayData';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import type { ReplayData } from '@/lib/share/types';

/**
 * Owns fetching the replay data so MissionScorecard stays presentational and
 * the waiting-room page takes a two-line diff.
 *
 * Renders nothing on failure, deliberately. Sharing is additive: an athlete
 * who just finished a mission should never be shown an error about a card they
 * did not ask for, and the scorecard behind it has to keep working. The failure
 * is visible in rpc_call telemetry, which is where it belongs.
 */
export function ShareCardSection({
  missionId,
  templateId,
}: {
  missionId: string;
  templateId: string | null;
}) {
  const [data, setData] = useState<ReplayData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchReplayData({
      missionId,
      participantId: getStoredParticipantId(missionId),
      claimToken: getStoredClaimToken(missionId),
      hostToken: getStoredHostToken(missionId),
    }).then((result) => {
      if (!cancelled && result.data) {
        setData(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  if (!data) {
    return null;
  }

  return (
    <ShareCardPanel
      data={data}
      workoutTitle={resolveWorkoutTitle(templateId)}
      participantId={getStoredParticipantId(missionId)}
      claimToken={getStoredClaimToken(missionId)}
      hostToken={getStoredHostToken(missionId)}
    />
  );
}
