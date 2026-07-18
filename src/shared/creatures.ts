// Creature kind union — a protocol-shaped type on the shared dependency
// floor, needed by both the engine (depth-banded spawn tables in
// src/engine/domain/creatures.ts) and the renderer (per-kind draw dispatch
// in src/rendering/draw/creatures.ts). Moved verbatim from
// src/lib/abyss-game.ts (Sprint 3, Commit E2).

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
