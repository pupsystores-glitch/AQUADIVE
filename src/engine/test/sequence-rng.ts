// Deterministic Rng for characterization tests (docs/06 §11: "Tests inject
// a seeded deterministic Rng"). Yields the given draws in order and counts
// calls, so tests can pin both arithmetic and the number/order of draws.

import type { Rng } from "../rng";

export class SequenceRng implements Rng {
  calls = 0;
  private i = 0;

  constructor(private readonly draws: readonly number[]) {}

  next(): number {
    if (this.i >= this.draws.length) {
      throw new Error(`SequenceRng exhausted after ${this.draws.length} draws`);
    }
    this.calls++;
    return this.draws[this.i++];
  }
}

/** Shorthand: seq(0.5, 0.25) → an Rng yielding those draws in order. */
export const seq = (...draws: number[]) => new SequenceRng(draws);
