// Public surface of src/engine (docs/06_ENGINE_ARCHITECTURE.md §4: nothing
// outside src/engine imports engine internals; only this barrel is imported
// from outside, mirroring the scene-renderer.ts convention). Since E6 the
// extraction is complete: the GameEngine facade with its §13 API
// (advance/submit/events/projections/snapshot/restore), the EngineDriver,
// the command/event edges, the RoundAuthority/Rng seams and the tuning
// constants are the whole public surface. The §7 clock constants are
// engine-internal now — outside consumers read projections, not ticks.
//
// Deliberately NOT exported: the outcome distributions in domain/outcomes.ts
// (sampleCrashPoint, sampleJackpot, rollBonusChests). Outcomes may only be
// drawn through a RoundAuthority (§16).

export {
  GameEngine,
  SNAPSHOT_SCHEMA_VERSION,
  type EnginePublicState,
  type EngineSnapshot,
  type GameEngineDeps,
} from "./game-engine";
export { EngineDriver, type EngineDriverSink } from "./driver";
export {
  ENGINE_STATE_TO_PHASE,
  type ParticipantRoundState,
  type RoundSnapshot,
} from "./state-machine";
export type { WorldSnapshot } from "./simulation";
export { EventBus, type EngineEventMap, type EngineStateName } from "./events";
export type { EngineCommand } from "./commands";
export { createMathRandomRng, type Rng } from "./rng";
export type { BonusChest } from "./domain/outcomes";
export type { Creature } from "./domain/creatures";
export { LocalRoundAuthority, type RoundAuthority } from "./round-authority";
export * from "./domain/tuning";
