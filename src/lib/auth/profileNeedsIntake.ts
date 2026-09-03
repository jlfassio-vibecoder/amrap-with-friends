/** True when an RPC/client error means identity is still missing. */
export function isIntakeRequiredMessage(message: string | undefined | null): boolean {
  if (!message) {
    return false;
  }
  return message.includes('Intake required') || message.includes('Complete your profile');
}

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
