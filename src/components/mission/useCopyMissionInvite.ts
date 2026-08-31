import { useEffect, useRef, useState } from 'react';
import { buildRallyInviteUrl } from '@/lib/mission/buildRallyInviteUrl';
import { buildRallyPointInviteUrl } from '@/lib/mission/buildRallyPointInviteUrl';
import { track } from '@/lib/analytics/track';
import type { OgCard } from '@/lib/share/ogCard';

const SECURED_MS = 2000;

export function useCopyMissionInvite(
  missionId: string,
  rallyPointId?: string | null,
  card: OgCard = 'f'
) {
  const [secured, setSecured] = useState(false);
  const [idSecured, setIdSecured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkTimerRef = useRef<number | null>(null);
  const idTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (linkTimerRef.current !== null) {
        window.clearTimeout(linkTimerRef.current);
      }
      if (idTimerRef.current !== null) {
        window.clearTimeout(idTimerRef.current);
      }
    };
  }, []);

  function flash(setFlag: (value: boolean) => void, timerRef: { current: number | null }) {
    setFlag(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setFlag(false);
      timerRef.current = null;
    }, SECURED_MS);
  }

  async function copyInvite() {
    setError(null);
    const inviteUrl = rallyPointId
      ? buildRallyPointInviteUrl(rallyPointId, window.location.origin, card)
      : buildRallyInviteUrl(missionId, window.location.origin, card);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      track('rally_link_copied', { rallyPoint: Boolean(rallyPointId) }, { missionId });
      flash(setSecured, linkTimerRef);
    } catch {
      setError(`Could not copy link. Copy this mission link manually: ${inviteUrl}`);
    }
  }

  async function copyMissionId() {
    setError(null);
    try {
      await navigator.clipboard.writeText(missionId);
      track('mission_id_copied', {}, { missionId });
      flash(setIdSecured, idTimerRef);
    } catch {
      setError(`Could not copy mission ID. Copy it manually: ${missionId}`);
    }
  }

  return { secured, idSecured, error, copyInvite, copyMissionId };
}
