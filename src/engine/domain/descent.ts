// Descent kinematics — pure domain math (docs/06_ENGINE_ARCHITECTURE.md §9).
// Moved verbatim from src/lib/abyss-game.ts (Sprint 3, Commit E2).

// Speed of descent (pixels per second) increases with multiplier
export function descentSpeed(multiplier: number): number {
  const base = 120;
  return base + Math.min(520, Math.pow(multiplier, 0.95) * 28);
}
