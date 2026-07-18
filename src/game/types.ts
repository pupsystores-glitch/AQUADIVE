// Game type definitions for Abyss Anchor.
//
// Runtime-neutral TypeScript types extracted from the game component
// (refactor: type system extraction). Since the E2 domain consolidation the
// core domain types live in the engine (Creature, BonusChest —
// src/engine/domain), on the shared floor (CreatureKind), or in the
// renderer contract (Phase — src/rendering/render-state.ts). This module
// keeps the UI-shell types. RunState dissolved in E4: crashAt and the dive
// clock moved into the engine's round state machine, the locked bet became
// the component's settlement-side roundBetRef, and the one-shot
// bonusTriggered flag became structural (the machine exits `diving`).

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
