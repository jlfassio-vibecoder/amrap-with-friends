const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export type ParsedInvitationLink =
  | { kind: 'mission'; missionId: string }
  | { kind: 'campaign'; inviteCode: string }
  | { kind: 'campaign_id'; campaignId: string }
  | { kind: 'squad'; inviteCode: string };

function tryUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(trimmed, 'https://amrapwithfriends.com');
    } catch {
      return null;
    }
  }
}

/**
 * Recognizes AWF mission, campaign, and squad invite URLs.
 * Ordinary pasted links (and unknown paths) return null so they are not
 * silently turned into inbox deliveries.
 */
export function parseInvitationLink(raw: string): ParsedInvitationLink | null {
  const url = tryUrl(raw);
  if (!url) {
    return null;
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  const missionParam = url.searchParams.get('m');
  if (
    (path === '/join' || path === '/') &&
    missionParam &&
    new RegExp(`^${UUID_RE}$`, 'i').test(missionParam)
  ) {
    return { kind: 'mission', missionId: missionParam.toLowerCase() };
  }

  const missionPath = path.match(new RegExp(`^/mission/(${UUID_RE})$`, 'i'));
  if (missionPath?.[1]) {
    return { kind: 'mission', missionId: missionPath[1].toLowerCase() };
  }

  const campaignCode = url.searchParams.get('c');
  if (path === '/campaign/join' && campaignCode && campaignCode.trim() !== '') {
    return { kind: 'campaign', inviteCode: campaignCode.trim() };
  }

  const campaignPath = path.match(new RegExp(`^/campaign/(${UUID_RE})$`, 'i'));
  if (campaignPath?.[1]) {
    return { kind: 'campaign_id', campaignId: campaignPath[1].toLowerCase() };
  }

  if (path === '/squad/join' && campaignCode && campaignCode.trim() !== '') {
    return { kind: 'squad', inviteCode: campaignCode.trim() };
  }

  return null;
}

/** True when the whole input (not a sentence containing a URL) is a recognized invite. */
export function isStandaloneInvitationLink(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }
  return parseInvitationLink(trimmed) !== null;
}
