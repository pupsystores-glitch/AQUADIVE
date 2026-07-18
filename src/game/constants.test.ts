// Characterization pins for UI-shell session defaults (Sprint 3, Commit E1;
// imports trimmed in E2 when the simulation/world/presentation values moved
// out per docs/06 §4 — their pins migrated with them to
// src/engine/domain/tuning.test.ts, src/shared/world.test.ts and
// src/rendering/constants.test.ts). This test is the tripwire that the
// values staying behind changed nothing.
import { describe, expect, it } from "vitest";
import { COUNTDOWN_TICK_MS, DEFAULT_BALANCE, DEFAULT_BET } from "@/game/constants";

describe("UI-shell default values (verbatim-move tripwire)", () => {
  it("pins player defaults and the countdown display interval", () => {
    expect(DEFAULT_BALANCE).toBe(1000);
    expect(DEFAULT_BET).toBe(5);
    expect(COUNTDOWN_TICK_MS).toBe(100);
  });
});
