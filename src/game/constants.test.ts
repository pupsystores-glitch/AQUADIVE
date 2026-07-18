// Characterization pins for UI-shell session defaults (Sprint 3, Commit E1;
// imports trimmed in E2 when the simulation/world/presentation values moved
// out per docs/06 §4 — their pins migrated with them to
// src/engine/domain/tuning.test.ts, src/shared/world.test.ts and
// src/rendering/constants.test.ts; the COUNTDOWN_TICK_MS pin was removed in
// E6 with its constant, deleted by sanctioned delta D5). This test is the
// tripwire that the values staying behind changed nothing.
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE, DEFAULT_BET } from "@/game/constants";

describe("UI-shell default values (verbatim-move tripwire)", () => {
  it("pins player defaults", () => {
    expect(DEFAULT_BALANCE).toBe(1000);
    expect(DEFAULT_BET).toBe(5);
  });
});
