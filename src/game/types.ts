// Game type definitions for Abyss Anchor.
//
// Runtime-neutral TypeScript types extracted from the game component
// (refactor: type system extraction). Since the E2 domain consolidation the
// core domain types live in the engine (Creature, BonusChest —
// src/engine/domain), on the shared floor (CreatureKind), or in the
// renderer contract (Phase — src/rendering/render-state.ts). This module
// keeps the UI/loop-shell types; RunState dissolves into engine state when
// the round state machine lands (E4/E5).

/** Per-round run state owned by the game loop while a dive is active. */
export interface RunState {
  startedAt: number;
  crashAt: number; // multiplier at which it crashes
  bet: number;
  bonusTriggered: boolean;
}

/** A finished round as shown in the history strip. */
export interface HistoryEntry {
  mult: number;
  crashed: boolean;
}

/** The player's most recent win (manual cashout, jackpot, or chest total). */
export interface LastWin {
  amount: number;
  mult: number;
}
