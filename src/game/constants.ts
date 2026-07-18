// UI-shell session defaults for Abyss Anchor.
//
// After the E2 domain consolidation (docs/06_ENGINE_ARCHITECTURE.md §4)
// this module keeps only wallet-side defaults (money never enters the
// engine — docs/06 §3). Simulation constants moved to
// src/engine/domain/tuning.ts; world geometry to src/shared/world.ts;
// presentation constants to src/rendering. The countdown display interval
// (COUNTDOWN_TICK_MS) was deleted at E6 by sanctioned delta D5 — the UI
// reads engine state per frame. Remaining values byte-identical.

// ----- Player defaults -----

/** Starting balance for a new session. */
export const DEFAULT_BALANCE = 1000;

/** Default bet amount when the game loads. */
export const DEFAULT_BET = 5;
