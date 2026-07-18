// UI-shell session defaults for Abyss Anchor.
//
// After the E2 domain consolidation (docs/06_ENGINE_ARCHITECTURE.md §4)
// this module keeps only wallet-side defaults (money never enters the
// engine — docs/06 §3) and the countdown display interval (deleted at E4
// by sanctioned delta D5, when the UI reads engine state per frame).
// Simulation constants moved to src/engine/domain/tuning.ts; world geometry
// to src/shared/world.ts; presentation constants to src/rendering. Values
// byte-identical.

// ----- Player defaults -----

/** Starting balance for a new session. */
export const DEFAULT_BALANCE = 1000;

/** Default bet amount when the game loads. */
export const DEFAULT_BET = 5;

// ----- UI timing -----

/** Betting-window countdown UI refresh interval (ms). */
export const COUNTDOWN_TICK_MS = 100;
