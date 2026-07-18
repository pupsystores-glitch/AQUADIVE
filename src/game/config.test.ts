// Characterization pins for gameplay tuning (Sprint 3, Commit E1;
// docs/06_ENGINE_ARCHITECTURE.md §21 step E1).
//
// docs/06 §9: "All formulas, tables and constants move verbatim." These
// values relocate during E2+ (engine domain / rendering / shared per §4);
// this test is the tripwire that the relocation changes nothing.
import { describe, expect, it } from "vitest";
import {
  ANCHOR_DRAW_H,
  ANCHOR_RING_Y_FRAC,
  BETTING_WINDOW_SECONDS,
  CASH_FLASH_MS,
  CHAIN_MAX_DEPTH,
  CHEST_RESULT_TO_IDLE_MS,
  COLLISION_DX_FRAC,
  COLLISION_DY_PX,
  CRASH_BANNER_MS,
  CREATURE_SPAWN_EVERY,
  HISTORY_LIMIT,
  JACKPOT_FLASH_MS,
  QUICK_BETS,
  SHIP_IMPACT_TO_CHESTS_MS,
} from "@/game/config";

describe("game config values (verbatim-move tripwire)", () => {
  it("pins betting and round timing", () => {
    expect(QUICK_BETS).toEqual([1, 5, 10, 25, 100]);
    expect(BETTING_WINDOW_SECONDS).toBe(5);
    expect(CASH_FLASH_MS).toBe(1800);
    expect(JACKPOT_FLASH_MS).toBe(2200);
    expect(CRASH_BANNER_MS).toBe(2400);
    expect(SHIP_IMPACT_TO_CHESTS_MS).toBe(1400);
    expect(CHEST_RESULT_TO_IDLE_MS).toBe(2200);
  });

  it("pins world, collision and presentation values", () => {
    expect(CHAIN_MAX_DEPTH).toBe(4200);
    expect(CREATURE_SPAWN_EVERY).toBe(52);
    expect(COLLISION_DY_PX).toBe(28);
    expect(COLLISION_DX_FRAC).toBe(0.18);
    expect(ANCHOR_DRAW_H).toBe(155);
    expect(ANCHOR_RING_Y_FRAC).toBe(0.135);
    expect(HISTORY_LIMIT).toBe(12);
  });
});
