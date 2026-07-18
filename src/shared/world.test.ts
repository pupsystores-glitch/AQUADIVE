// Characterization pins for shared world geometry (pinned in E1 in
// src/game/config.test.ts and src/game/constants.test.ts; migrated in E2
// when the values moved verbatim to the src/shared dependency floor per
// docs/06 §4). This test is the tripwire that the relocation changed
// nothing.
import { describe, expect, it } from "vitest";
import { ANCHOR_WORLD_OFFSET_PX, CHAIN_MAX_DEPTH, SHIP_WORLD_Y } from "./world";

describe("shared world-geometry values (verbatim-move tripwire)", () => {
  it("pins the world geometry", () => {
    expect(CHAIN_MAX_DEPTH).toBe(4200);
    expect(ANCHOR_WORLD_OFFSET_PX).toBe(220);
    expect(SHIP_WORLD_Y).toBe(-180);
  });
});
