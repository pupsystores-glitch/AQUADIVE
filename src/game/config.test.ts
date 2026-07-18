// Characterization pins for UI-shell tuning (Sprint 3, Commit E1; imports
// trimmed in E2 when the gameplay/world/presentation values moved out per
// docs/06 §4 — their pins migrated with them to src/engine/domain/tuning.test.ts,
// src/shared/world.test.ts and src/rendering/constants.test.ts). This test
// is the tripwire that the values staying behind changed nothing.
import { describe, expect, it } from "vitest";
import { CASH_FLASH_MS, HISTORY_LIMIT, JACKPOT_FLASH_MS, QUICK_BETS } from "@/game/config";

describe("UI-shell config values (verbatim-move tripwire)", () => {
  it("pins betting panel, history and flash timings", () => {
    expect(QUICK_BETS).toEqual([1, 5, 10, 25, 100]);
    expect(HISTORY_LIMIT).toBe(12);
    expect(CASH_FLASH_MS).toBe(1800);
    expect(JACKPOT_FLASH_MS).toBe(2200);
  });
});
