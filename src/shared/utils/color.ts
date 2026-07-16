// Pure color utilities. No React, no Canvas, no game state.

/** Linearly interpolate between two RGB triplets; each channel rounded to an integer. */
export function lerpColor(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
