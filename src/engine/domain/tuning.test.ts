// Characterization pins for engine gameplay tuning (pinned in E1 in
// src/game/config.test.ts and src/game/constants.test.ts; migrated in E2
// when the values moved verbatim to src/engine/domain/tuning.ts per
// docs/06 §4). This test is the tripwire that the relocation changed
// nothing.
import { describe, expect, it } from "vitest";
import {
  BETTING_WINDOW_SECONDS,
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  BOOST_SPEED_FACTOR,
  CHEST_RESULT_TO_IDLE_MS,
  COLLISION_DX_FRAC,
  COLLISION_DY_PX,
  CRASH_BANNER_MS,
  CREATURE_SPAWN_EVERY,
  DIVE_SPAWN_DEPTH_PX,
  INITIAL_SPAWN_DEPTH_PX,
  MAX_TICK_SECONDS,
  SHIP_IMPACT_TO_CHESTS_MS,
  SPAWN_AHEAD_PX,
  SPAWN_JITTER_PX,
} from "./tuning";

describe("engine tuning values (verbatim-move tripwire)", () => {
  it("pins round lifecycle timing", () => {
    expect(BETTING_WINDOW_SECONDS).toBe(5);
    expect(CRASH_BANNER_MS).toBe(2400);
    expect(SHIP_IMPACT_TO_CHESTS_MS).toBe(1400);
    expect(CHEST_RESULT_TO_IDLE_MS).toBe(2200);
  });

  it("pins loop, spawn and collision values", () => {
    expect(MAX_TICK_SECONDS).toBe(0.05);
    expect(CREATURE_SPAWN_EVERY).toBe(52);
    expect(SPAWN_AHEAD_PX).toBe(900);
    expect(SPAWN_JITTER_PX).toBe(18);
    expect(INITIAL_SPAWN_DEPTH_PX).toBe(120);
    expect(DIVE_SPAWN_DEPTH_PX).toBe(60);
    expect(COLLISION_DY_PX).toBe(28);
    expect(COLLISION_DX_FRAC).toBe(0.18);
  });

  it("pins golden-boost tuning", () => {
    expect(BOOST_DECAY_PER_SECOND).toBe(0.6);
    expect(BOOST_MULTIPLIER_BONUS).toBe(0.4);
    expect(BOOST_GAIN_PER_GOLDFISH).toBe(0.8);
    expect(BOOST_SPEED_FACTOR).toBe(0.8);
  });
});
