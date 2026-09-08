/** "× 1.15", never "× 1.150" — two decimals of precision, trailing zeros dropped. */
export function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}
