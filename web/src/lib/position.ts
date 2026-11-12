/** Fractional ordering: moving one item rewrites only that item's position. */
export const STEP = 1024;
const MIN_GAP = 1e-6;

/** Position strictly between prev and next (either may be missing). */
export function between(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return STEP;
  if (prev === undefined) return next! - STEP;
  if (next === undefined) return prev + STEP;
  return (prev + next) / 2;
}

/** True when neighbours are so close that the list should be renumbered. */
export function needsRebalance(prev: number | undefined, next: number | undefined): boolean {
  return prev !== undefined && next !== undefined && Math.abs(next - prev) < MIN_GAP;
}

export const endPosition = (positions: number[]) => (positions.length ? Math.max(...positions) + STEP : STEP);
