import type { RallyPointMember } from '@/lib/api/rallyPoint';

/** Pass Command targets: active claimed crewmate who is not the current user. */
export function canPassRallyPointCommand(
  member: Pick<RallyPointMember, 'status' | 'userId'>,
  selfUserId: string | null | undefined
): boolean {
  return (
    Boolean(selfUserId) &&
    member.status === 'active' &&
    Boolean(member.userId) &&
    member.userId !== selfUserId
  );
}
