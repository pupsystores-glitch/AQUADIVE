// Public surface of src/engine (docs/06_ENGINE_ARCHITECTURE.md §4: nothing
// outside src/engine imports engine internals; only this barrel is imported
// from outside, mirroring the scene-renderer.ts convention). Since E5 the
// simulation systems live inside the engine, so the domain functions
// (multiplier curve, descent, creature rolls) are no longer exported — the
// GameEngine facade, its command/event edges, the RoundAuthority/Rng seams
// and the tuning constants are the whole public surface.
//
// Deliberately NOT exported: the outcome distributions in domain/outcomes.ts
// (sampleCrashPoint, sampleJackpot, rollBonusChests). Outcomes may only be
// drawn through a RoundAuthority (§16).

export { GameEngine, type GameEngineDeps } from "./game-engine";
export { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
export { ENGINE_STATE_TO_PHASE } from "./state-machine";
export { EventBus, type EngineEventMap, type EngineStateName } from "./events";
export type { EngineCommand } from "./commands";
export { createMathRandomRng, type Rng } from "./rng";
export type { BonusChest } from "./domain/outcomes";
export type { Creature } from "./domain/creatures";
export { LocalRoundAuthority, type RoundAuthority } from "./round-authority";
export * from "./domain/tuning";
