// Characterization pins for static constants (Sprint 3, Commit E1;
// docs/06_ENGINE_ARCHITECTURE.md §21 step E1).
//
// docs/06 §9: "All formulas, tables and constants move verbatim." These
// values relocate during E2+ (engine domain / rendering / shared per §4);
// this test is the tripwire that the relocation changes nothing.
import { describe, expect, it } from "vitest";
import {
  ANCHOR_SCREEN_Y_FRAC,
  ANCHOR_WORLD_OFFSET_PX,
  BG_BOTTOM_ABYSS,
  BG_BOTTOM_SURFACE,
  BG_TOP_ABYSS,
  BG_TOP_SURFACE,
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  BOOST_SPEED_FACTOR,
  COUNTDOWN_TICK_MS,
  DEFAULT_BALANCE,
  DEFAULT_BET,
  DIVE_SPAWN_DEPTH_PX,
  INITIAL_SPAWN_DEPTH_PX,
  MAX_DPR,
  MAX_TICK_SECONDS,
  SHIP_IMPACT_FX_SECONDS,
  SHIP_WORLD_Y,
  SPAWN_AHEAD_PX,
  SPAWN_JITTER_PX,
} from "@/game/constants";

describe("game constants values (verbatim-move tripwire)", () => {
  it("pins player defaults and loop limits", () => {
    expect(DEFAULT_BALANCE).toBe(1000);
    expect(DEFAULT_BET).toBe(5);
    expect(MAX_TICK_SECONDS).toBe(0.05);
    expect(COUNTDOWN_TICK_MS).toBe(100);
  });

  it("pins spawn and world geometry", () => {
    expect(SPAWN_AHEAD_PX).toBe(900);
    expect(SPAWN_JITTER_PX).toBe(18);
    expect(INITIAL_SPAWN_DEPTH_PX).toBe(120);
    expect(DIVE_SPAWN_DEPTH_PX).toBe(60);
    expect(ANCHOR_WORLD_OFFSET_PX).toBe(220);
    expect(SHIP_WORLD_Y).toBe(-180);
  });

  it("pins golden-boost tuning", () => {
    expect(BOOST_DECAY_PER_SECOND).toBe(0.6);
    expect(BOOST_MULTIPLIER_BONUS).toBe(0.4);
    expect(BOOST_GAIN_PER_GOLDFISH).toBe(0.8);
    expect(BOOST_SPEED_FACTOR).toBe(0.8);
  });

  it("pins rendering constants", () => {
    expect(MAX_DPR).toBe(2);
    expect(ANCHOR_SCREEN_Y_FRAC).toBe(0.55);
    expect(SHIP_IMPACT_FX_SECONDS).toBe(1.4);
    expect(BG_TOP_SURFACE).toEqual([60, 130, 165]);
    expect(BG_TOP_ABYSS).toEqual([8, 18, 40]);
    expect(BG_BOTTOM_SURFACE).toEqual([14, 40, 80]);
    expect(BG_BOTTOM_ABYSS).toEqual([2, 6, 18]);
  });
});
