// UI-shell tuning for Abyss Anchor.
//
// After the E2 domain consolidation (docs/06_ENGINE_ARCHITECTURE.md §4)
// this module keeps only values owned by the React shell: betting-panel
// quick-picks, the history strip, and pure UI flash timings (presentation,
// not round lifecycle — docs/06 §8). Gameplay tuning moved to
// src/engine/domain/tuning.ts; world geometry to src/shared/world.ts;
// presentation constants to src/rendering. Values byte-identical.

// ----- Betting panel -----

/** Quick-select bet amounts shown under the bet input. */
export const QUICK_BETS = [1, 5, 10, 25, 100] as const;

// ----- Round history -----

/** Max number of past-round results kept in the history strip. */
export const HISTORY_LIMIT = 12;

// ----- UI flash timings (ms) -----

/** How long the green "CASHED OUT" flash stays visible after a manual cashout. */
export const CASH_FLASH_MS = 1800;

/** How long the "CASHED OUT" flash stays visible after a sea-floor jackpot. */
export const JACKPOT_FLASH_MS = 2200;
