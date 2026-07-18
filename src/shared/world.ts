// World-geometry constants needed by both the engine (simulation) and the
// renderer — the src/shared dependency floor (docs/06_ENGINE_ARCHITECTURE.md
// §4 constants ownership). Values are byte-identical to their previous homes
// in src/game/config.ts and src/game/constants.ts (Sprint 3, Commit E2).

/** World px – when the anchor reaches this depth → ship impact / bonus zone. */
export const CHAIN_MAX_DEPTH = 4200;

/** Vertical offset (world px) from tracked depth to the anchor's collision/camera point. */
export const ANCHOR_WORLD_OFFSET_PX = 220;

/** Surface ship's world-Y position (world px above the dive start); shared by the World layer (ship draw/culling) and Actor layer (chain top attachment). */
export const SHIP_WORLD_Y = -180;
