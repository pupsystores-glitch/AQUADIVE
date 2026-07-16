// Core game logic for Abyss Anchor — pure functions + types.

export type Phase = "idle" | "diving" | "cashed" | "crashed" | "bonus";

export type CreatureKind =
  | "fishSchool"
  | "octopus"
  | "sealion"
  | "whale"
  | "goldfish"
  | "seahorse"
  | "kelp"
  | "jellyfish"
  | "manta"
  | "anglerfish";


export interface Creature {
  id: number;
  kind: CreatureKind;
  x: number; // 0..1 horizontal position
  worldY: number; // absolute depth (pixels in world space)
  size: number;
  phase: number; // anim offset
  dir: 1 | -1;
  consumed?: boolean;
}

export interface BonusChest {
  id: 0 | 1 | 2;
  multiplier: number;
  opened: boolean;
}

// Sample crash point — heavy-tailed distribution (Aviator-style).
// Returns a multiplier where the anchor's chain snaps.
export function sampleCrashPoint(): number {
  const r = Math.random();
  // 3% house edge style
  if (r < 0.03) return 1.0;
  // exponential-ish curve, occasional very high values
  const u = Math.random();
  const m = 0.99 / (1 - u);
  return Math.max(1.01, Math.min(m, 200));
}

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

// Speed of descent (pixels per second) increases with multiplier
export function descentSpeed(multiplier: number): number {
  const base = 120;
  return base + Math.min(520, Math.pow(multiplier, 0.95) * 28);
}

export function formatMultiplier(m: number): string {
  return m.toFixed(2) + "×";
}

export function rollBonusChests(): [BonusChest, BonusChest, BonusChest] {
  const roll = (): number => {
    const r = Math.random();
    if (r < 0.6) return 1 + Math.random() * 2; // small
    if (r < 0.92) return 3 + Math.random() * 7; // medium
    return 10 + Math.random() * 40; // rare big
  };
  return [
    { id: 0, multiplier: +roll().toFixed(2), opened: false },
    { id: 1, multiplier: +roll().toFixed(2), opened: false },
    { id: 2, multiplier: +roll().toFixed(2), opened: false },
  ];
}

// Chain tier from bet size
export function chainTier(bet: number): "rope" | "chain" | "heavy" {
  if (bet < 5) return "rope";
  if (bet < 25) return "chain";
  return "heavy";
}
