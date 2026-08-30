import type { LobbyMember } from '@/lib/api/lobby';

/** Pass Command targets: active claimed crewmate who is not the current user. */
export function canPassLobbyCommand(
  member: Pick<LobbyMember, 'status' | 'userId'>,
  selfUserId: string | null | undefined
): boolean {
  return (
    Boolean(selfUserId) &&
    member.status === 'active' &&
    Boolean(member.userId) &&
    member.userId !== selfUserId
  );
}
