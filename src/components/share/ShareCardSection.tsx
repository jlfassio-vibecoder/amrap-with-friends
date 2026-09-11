import { useEffect, useState } from 'react';
import { ShareCardPanel } from '@/components/share/ShareCardPanel';
import {
  getStoredClaimToken,
  getStoredHostToken,
  getStoredParticipantId,
} from '@/lib/missionIdentity';
import { getMissionRoom, type MissionRoom } from '@/lib/api/rooms';
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
 *
 * Keyed on the mission so both fetches start from nothing when it changes.
 * Resetting them inside an effect instead would leave one render showing the
 * previous mission's card -- and once a room brands that card, "the previous
 * mission's" means another coach's colours on this coach's result.
 */
export function ShareCardSection({
  missionId,
  templateId,
}: {
  missionId: string;
  templateId: string | null;
}) {
  return <ShareCardFetcher key={missionId} missionId={missionId} templateId={templateId} />;
}

function ShareCardFetcher({
  missionId,
  templateId,
}: {
  missionId: string;
  templateId: string | null;
}) {
  const [data, setData] = useState<ReplayData | null>(null);
  // Null covers both "no room" and "we could not find out", and both mean the
  // same thing to the card: draw it in the house colours. A branding lookup is
  // never allowed to hold up or break the card itself.
  const [room, setRoom] = useState<MissionRoom | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    void getMissionRoom(missionId).then((found) => {
      if (!cancelled) {
        setRoom(found);
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
      room={room}
      participantId={getStoredParticipantId(missionId)}
      claimToken={getStoredClaimToken(missionId)}
      hostToken={getStoredHostToken(missionId)}
    />
  );
}
