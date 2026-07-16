// Game configuration for Abyss Anchor.
//
// Single source of truth for gameplay tuning values that were previously
// hardcoded inside the game component. Values must stay identical to the
// original prototype — this module only centralizes them (refactor Step 1.1).

// ----- Betting -----

/** Quick-select bet amounts shown under the bet input. */
export const QUICK_BETS = [1, 5, 10, 25, 100] as const;

/** Length of the betting window between rounds (seconds). */
export const BETTING_WINDOW_SECONDS = 5;

// ----- World / dive -----

/** World px – when the anchor reaches this depth → ship impact / bonus zone. */
export const CHAIN_MAX_DEPTH = 4200;

/** World px between creature spawns (denser sea life). */
export const CREATURE_SPAWN_EVERY = 52;

// ----- Collision (goldfish pickup) -----

/** Max vertical distance (world px) between anchor tip and a creature to collide. */
export const COLLISION_DY_PX = 28;

/** Max horizontal distance (fraction of screen width from center) to collide. */
export const COLLISION_DX_FRAC = 0.18;

// ----- Anchor sprite -----

/** Drawn height of the anchor sprite on screen (px). */
export const ANCHOR_DRAW_H = 155;

/** Ring center vertical position within the anchor sprite (fraction of image height). */
export const ANCHOR_RING_Y_FRAC = 0.135;

// ----- Round history -----

/** Max number of past-round results kept in the history strip. */
export const HISTORY_LIMIT = 12;

// ----- Phase / banner timings (ms) -----

/** How long the green "CASHED OUT" flash stays visible after a manual cashout. */
export const CASH_FLASH_MS = 1800;

/** How long the "CASHED OUT" flash stays visible after a sea-floor jackpot. */
export const JACKPOT_FLASH_MS = 2200;

/** How long the crash banner shows before returning to the betting window. */
export const CRASH_BANNER_MS = 2400;

/** Delay between ship impact and revealing the three bonus chests. */
export const SHIP_IMPACT_TO_CHESTS_MS = 1400;

/** Delay between picking a chest and returning to the betting window. */
export const CHEST_RESULT_TO_IDLE_MS = 2200;
