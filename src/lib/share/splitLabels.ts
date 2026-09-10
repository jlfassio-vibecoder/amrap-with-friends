/**
 * Which round-split labels to draw under the chart.
 *
 * Every bar used to get one, at a fixed 24px. That is fine to about seventeen
 * rounds; past that the labels are wider than the bars are apart and they
 * overprint into a smear — a 24-round card read "0:270:100:100:10…". The bars
 * were still legible, so the chart looked right until you tried to read a
 * time.
 *
 * Thinning beats shrinking on its own: nobody reads twenty-four split times
 * off a card, and type small enough for all of them to fit would be too small
 * for any of them. So the labels that survive are the ones that carry the
 * story — the slowest round first, because it is the accent bar and the reason
 * the chart is on the card at all, then the ends, then whatever else clears.
 */

/** Breathing room between two labels, so "clears" means visibly clears. */
const LABEL_PADDING = 8;

export function splitLabelIndices(input: {
  count: number;
  /** Centre-to-centre distance between neighbouring bars. */
  pitch: number;
  /** Width of the widest label at the size it will be drawn. */
  labelWidth: number;
  /** The accent bar. Its time is the one worth reading. */
  slowestIndex: number;
}): number[] {
  const { count, pitch, labelWidth, slowestIndex } = input;
  if (count <= 0) {
    return [];
  }
  if (pitch <= 0) {
    return [];
  }

  // Priority order: the slowest round, then the two ends, then left to right.
  // Anything already in the list is skipped when the tail repeats it.
  const priority = [slowestIndex, 0, count - 1, ...Array.from({ length: count }, (_, i) => i)];

  const accepted: number[] = [];
  for (const index of priority) {
    if (index < 0 || index >= count || accepted.includes(index)) {
      continue;
    }
    const clears = accepted.every(
      (other) => Math.abs(index - other) * pitch >= labelWidth + LABEL_PADDING
    );
    if (clears) {
      accepted.push(index);
    }
  }
  return accepted.sort((a, b) => a - b);
}

/**
 * The largest size in `sizes` whose label still fits the pitch, or the
 * smallest if none do — shrink first, then let thinning take the rest. Sizes
 * are tried in the order given, so pass them largest first.
 */
export function splitLabelSize(
  sizes: number[],
  pitch: number,
  widthAt: (size: number) => number
): number {
  let smallest = sizes[sizes.length - 1] ?? 0;
  for (const size of sizes) {
    if (widthAt(size) + LABEL_PADDING <= pitch) {
      return size;
    }
    smallest = size;
  }
  return smallest;
}
