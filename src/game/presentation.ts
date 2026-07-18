// UI presentation helpers — user-facing strings/labels derived from
// gameplay values. Moved verbatim from src/lib/abyss-game.ts in the E2
// domain consolidation: the engine emits no user-facing strings (docs/06
// §3), so these live with the React shell, not in src/engine.

export function formatMultiplier(m: number): string {
  return m.toFixed(2) + "×";
}

// Chain tier from bet size
export function chainTier(bet: number): "rope" | "chain" | "heavy" {
  if (bet < 5) return "rope";
  if (bet < 25) return "chain";
  return "heavy";
}
