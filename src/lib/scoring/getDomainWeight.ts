export function getDomainWeight(durationMinutes: number): number {
  switch (durationMinutes) {
    case 5:
      return 1.0;
    case 10:
      return 1.2;
    case 15:
      return 1.5;
    case 20:
      return 1.8;
    default:
      return 1.0;
  }
}
