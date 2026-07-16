// Game type definitions for Abyss Anchor.
//
// Runtime-neutral TypeScript types extracted from the game component
// (refactor: type system extraction). Core domain types (Phase, Creature,
// CreatureKind, BonusChest) continue to live beside the pure game math in
// src/lib/abyss-game.ts until the module reorganization step.

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
