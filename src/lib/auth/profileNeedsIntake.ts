/** True when the athlete still needs username + nickname before create RPCs. */
export function profileNeedsIntake(
  profile: {
    username: string;
    nickname: string;
  } | null,
  missing = false
): boolean {
  if (missing || !profile) {
    return true;
  }
  return !profile.username.trim() || !profile.nickname.trim();
}
