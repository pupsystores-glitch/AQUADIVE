// Public surface of src/engine (docs/06_ENGINE_ARCHITECTURE.md §4: nothing
// outside src/engine imports engine internals). Until the GameEngine facade
// lands in E3, this barrel IS the public surface — the game component
// imports the domain modules and the RoundAuthority seam from here,
// mirroring the scene-renderer.ts convention on the rendering side.
//
// Deliberately NOT exported: the outcome distributions in domain/outcomes.ts
// (sampleCrashPoint, sampleJackpot, rollBonusChests). Outcomes may only be
// drawn through a RoundAuthority (§16).

export { createMathRandomRng, type Rng } from "./rng";
export { multiplierAt, timeForMultiplier } from "./domain/multiplier";
export { descentSpeed } from "./domain/descent";
export type { BonusChest } from "./domain/outcomes";
export { rollCreature, type Creature } from "./domain/creatures";
export { LocalRoundAuthority, type RoundAuthority } from "./round-authority";
export * from "./domain/tuning";
