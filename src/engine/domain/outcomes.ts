// Outcome distributions — pure domain functions over an injected Rng
// (docs/06_ENGINE_ARCHITECTURE.md §9, §11). Every formula is moved verbatim:
// sampleCrashPoint and rollBonusChests from src/lib/abyss-game.ts,
// sampleJackpot from src/components/AbyssAnchor.tsx (the deferred micro-task
// folded into E2 per §20 risk 5, owner-approved). The known jackpot RTP flaw
// (TASK 001) moves with it on purpose; rebalance is a separate approved task.
//
// In production code only the RoundAuthority (src/engine/round-authority.ts)
// draws these — it binds them to the `outcome` stream (§16). They are not
// re-exported from the engine's public surface.

import type { Rng } from "../rng";

export interface BonusChest {
  id: 0 | 1 | 2;
  multiplier: number;
  opened: boolean;
}

// Sample crash point — heavy-tailed distribution (Aviator-style).
// Returns a multiplier where the anchor's chain snaps.
export function sampleCrashPoint(rng: Rng): number {
  const r = rng.next();
  // 3% house edge style
  if (r < 0.03) return 1.0;
  // exponential-ish curve, occasional very high values
  const u = rng.next();
  const m = 0.99 / (1 - u);
  return Math.max(1.01, Math.min(m, 200));
}

// Jackpot multiplier when the anchor reaches the sea floor.
// Weighted: 50% → 50–100×, 35% → 100–200×, 15% → 200–500×.
export function sampleJackpot(rng: Rng): number {
  const r = rng.next();
  let m: number;
  if (r < 0.5) m = 50 + rng.next() * 50;
  else if (r < 0.85) m = 100 + rng.next() * 100;
  else m = 200 + rng.next() * 300;
  return +m.toFixed(2);
}

export function rollBonusChests(rng: Rng): [BonusChest, BonusChest, BonusChest] {
  const roll = (): number => {
    const r = rng.next();
    if (r < 0.6) return 1 + rng.next() * 2; // small
    if (r < 0.92) return 3 + rng.next() * 7; // medium
    return 10 + rng.next() * 40; // rare big
  };
  return [
    { id: 0, multiplier: +roll().toFixed(2), opened: false },
    { id: 1, multiplier: +roll().toFixed(2), opened: false },
    { id: 2, multiplier: +roll().toFixed(2), opened: false },
  ];
}
