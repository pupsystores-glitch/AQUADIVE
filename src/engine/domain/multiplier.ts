// Multiplier curve — pure domain math (docs/06_ENGINE_ARCHITECTURE.md §9).
// Moved verbatim from src/lib/abyss-game.ts (Sprint 3, Commit E2).
//
// The curve is an analytic function of dive-elapsed time shared by client
// and server in Phase 8; timeForMultiplier is its inverse, kept for
// replica-mode extrapolation (§17).

// Multiplier growth based on elapsed time (seconds).
// Slow near surface, accelerating with depth.
export function multiplierAt(tSeconds: number): number {
  // m(t) = e^(k*t) with k starting small
  const k = 0.085;
  return 1 + (Math.exp(k * tSeconds) - 1);
}

// Inverse: time required to reach a given multiplier
export function timeForMultiplier(m: number): number {
  const k = 0.085;
  return Math.log(m) / k;
}
