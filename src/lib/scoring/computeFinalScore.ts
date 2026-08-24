export function computeFinalScore(
  baseScore: number,
  pviMultiplier: number,
  domainWeight: number
): number {
  return Math.round(baseScore * pviMultiplier * domainWeight);
}
