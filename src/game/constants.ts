// Static constants for Abyss Anchor.
//
// Presentation, physics and default-value constants that were previously
// hardcoded inside the game component. Values are byte-identical to the
// prototype — this module only centralizes them (Sprint 1, Commit 3).
//
// Gameplay tuning (round timings, economics, bet options) lives in
// src/game/config.ts; colors and literals inside the standalone canvas
// draw helpers move together with those functions in the rendering
// extraction step.

// ----- Player defaults -----

/** Starting balance for a new session. */
export const DEFAULT_BALANCE = 1000;

/** Default bet amount when the game loads. */
export const DEFAULT_BET = 5;

// ----- Game loop / physics limits -----

/** Max simulation step per frame (seconds) — clamps rAF gaps after tab switches. */
export const MAX_TICK_SECONDS = 0.05;

/** How far below the current depth (world px) creatures are pre-spawned. */
export const SPAWN_AHEAD_PX = 900;

/** Random reduction (world px) applied to each spawn interval. */
export const SPAWN_JITTER_PX = 18;

/** First spawn trigger depth (world px) before any dive has started. */
export const INITIAL_SPAWN_DEPTH_PX = 120;

/** First spawn trigger depth (world px) at the start of each dive. */
export const DIVE_SPAWN_DEPTH_PX = 60;

/** Vertical offset (world px) from tracked depth to the anchor's collision/camera point. */
export const ANCHOR_WORLD_OFFSET_PX = 220;

// ----- Golden boost tuning -----

/** Boost decay per second while active. */
export const BOOST_DECAY_PER_SECOND = 0.6;

/** Multiplier bump added per unit of active boost. */
export const BOOST_MULTIPLIER_BONUS = 0.4;

/** Boost gained when the anchor consumes a goldfish. */
export const BOOST_GAIN_PER_GOLDFISH = 0.8;

/** Descent speed factor per unit of active boost. */
export const BOOST_SPEED_FACTOR = 0.8;

// ----- UI timing -----

/** Betting-window countdown UI refresh interval (ms). */
export const COUNTDOWN_TICK_MS = 100;

// ----- Rendering / camera -----

/** Device pixel ratio cap for the canvas backing store. */
export const MAX_DPR = 2;

/** Anchor's fixed vertical position on screen (fraction of canvas height). */
export const ANCHOR_SCREEN_Y_FRAC = 0.55;

/** Surface ship's world-Y position (world px above the dive start); shared by the World layer (ship draw/culling) and Actor layer (chain top attachment). */
export const SHIP_WORLD_Y = -180;

/** Ship-impact jackpot FX lifetime (seconds); pairs with SHIP_IMPACT_TO_CHESTS_MS. */
export const SHIP_IMPACT_FX_SECONDS = 1.4;

// ----- Scene background palette (RGB triplets for lerpColor) -----

/** Gradient top color near the surface. */
export const BG_TOP_SURFACE: number[] = [60, 130, 165];

/** Gradient top color in the abyss. */
export const BG_TOP_ABYSS: number[] = [8, 18, 40];

/** Gradient bottom color near the surface. */
export const BG_BOTTOM_SURFACE: number[] = [14, 40, 80];

/** Gradient bottom color in the abyss. */
export const BG_BOTTOM_ABYSS: number[] = [2, 6, 18];
