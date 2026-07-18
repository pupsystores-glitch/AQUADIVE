// Characterization pins for presentation constants (pinned in E1 in
// src/game/config.test.ts and src/game/constants.test.ts; migrated in E2
// when the values moved verbatim under src/rendering per docs/06 §4 —
// scalars into constants.ts, background palette colors into theme.ts).
// This test is the tripwire that the relocation changed nothing.
import { describe, expect, it } from "vitest";
import {
  ANCHOR_DRAW_H,
  ANCHOR_RING_Y_FRAC,
  ANCHOR_SCREEN_Y_FRAC,
  MAX_DPR,
  SHIP_IMPACT_FX_SECONDS,
} from "./constants";
import { BG_BOTTOM_ABYSS, BG_BOTTOM_SURFACE, BG_TOP_ABYSS, BG_TOP_SURFACE } from "./theme";

describe("rendering presentation values (verbatim-move tripwire)", () => {
  it("pins canvas and anchor presentation constants", () => {
    expect(MAX_DPR).toBe(2);
    expect(ANCHOR_SCREEN_Y_FRAC).toBe(0.55);
    expect(ANCHOR_DRAW_H).toBe(155);
    expect(ANCHOR_RING_Y_FRAC).toBe(0.135);
    expect(SHIP_IMPACT_FX_SECONDS).toBe(1.4);
  });

  it("pins the background palette", () => {
    expect(BG_TOP_SURFACE).toEqual([60, 130, 165]);
    expect(BG_TOP_ABYSS).toEqual([8, 18, 40]);
    expect(BG_BOTTOM_SURFACE).toEqual([14, 40, 80]);
    expect(BG_BOTTOM_ABYSS).toEqual([2, 6, 18]);
  });
});
