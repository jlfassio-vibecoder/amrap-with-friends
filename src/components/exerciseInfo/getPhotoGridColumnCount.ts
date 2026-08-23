/** Column count for the exercise photos grid: 1→1, 2→2, 3+→3. */
export function getPhotoGridColumnCount(photoCount: number): number {
  if (photoCount <= 0) {
    return 0;
  }

  return Math.min(photoCount, 3);
}
