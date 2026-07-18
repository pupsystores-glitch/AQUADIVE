// Rng service — the engine's only randomness source (docs/06_ENGINE_ARCHITECTURE.md §11).
//
// Every draw site inside src/engine takes an injected Rng; Math.random
// appears nowhere in the engine except the local implementation below (§4).
// Two named streams exist by convention — `outcome` (crash point, jackpot,
// chest values; owned by the RoundAuthority) and `world` (spawn intervals,
// creature kinds/attributes) — drawn independently so Phase 8 can seed and
// disclose them separately. In authority mode both are Math.random-backed;
// tests inject deterministic sequences instead.

/** A uniform random stream: next() returns a number in [0, 1). */
export interface Rng {
  next(): number;
}

/** Authority-mode stream backed by Math.random — the only sanctioned Math.random call site in src/engine (§4, §11). */
export function createMathRandomRng(): Rng {
  return { next: () => Math.random() };
}
