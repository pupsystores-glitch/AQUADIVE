// Engine gameplay tuning + simulation constants
// (docs/06_ENGINE_ARCHITECTURE.md §4 constants ownership). Values are
// byte-identical to their previous homes in src/game/config.ts and
// src/game/constants.ts (Sprint 3, Commit E2).
//
// This is the future server-configurable surface: E3's EngineConfig carries
// these values injected at construction (§13). The *_MS round-lifecycle
// timings become state-machine durations on the simulation clock at E4 (§8).

// ----- Round lifecycle -----

/** Length of the betting window between rounds (seconds). */
export const BETTING_WINDOW_SECONDS = 5;

/** How long the crash banner shows before returning to the betting window. */
export const CRASH_BANNER_MS = 2400;

/** Delay between ship impact and revealing the three bonus chests. */
export const SHIP_IMPACT_TO_CHESTS_MS = 1400;

/** Delay between picking a chest and returning to the betting window. */
export const CHEST_RESULT_TO_IDLE_MS = 2200;

// ----- Game loop / physics limits -----

/** Max simulation step per frame (seconds) — clamps rAF gaps after tab switches. */
export const MAX_TICK_SECONDS = 0.05;

// ----- Creature spawning -----

/** World px between creature spawns (denser sea life). */
export const CREATURE_SPAWN_EVERY = 52;

/** How far below the current depth (world px) creatures are pre-spawned. */
export const SPAWN_AHEAD_PX = 900;

/** Random reduction (world px) applied to each spawn interval. */
export const SPAWN_JITTER_PX = 18;

/** First spawn trigger depth (world px) before any dive has started. */
export const INITIAL_SPAWN_DEPTH_PX = 120;

/** First spawn trigger depth (world px) at the start of each dive. */
export const DIVE_SPAWN_DEPTH_PX = 60;

// ----- Collision (goldfish pickup) -----

/** Max vertical distance (world px) between anchor tip and a creature to collide. */
export const COLLISION_DY_PX = 28;

/** Max horizontal distance (fraction of screen width from center) to collide. */
export const COLLISION_DX_FRAC = 0.18;

// ----- Golden boost tuning -----

/** Boost decay per second while active. */
export const BOOST_DECAY_PER_SECOND = 0.6;

/** Multiplier bump added per unit of active boost. */
export const BOOST_MULTIPLIER_BONUS = 0.4;

/** Boost gained when the anchor consumes a goldfish. */
export const BOOST_GAIN_PER_GOLDFISH = 0.8;

/** Descent speed factor per unit of active boost. */
export const BOOST_SPEED_FACTOR = 0.8;
