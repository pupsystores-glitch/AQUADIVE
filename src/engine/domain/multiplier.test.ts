// Characterization tests for the multiplier curve (pinned in E1 as part of
// src/lib/abyss-game.test.ts; imports migrated in E2 when the functions
// moved verbatim to src/engine/domain/multiplier.ts). Golden values are
// unchanged — a failure here means the move changed behavior.
import { describe, expect, it } from "vitest";
import { multiplierAt, timeForMultiplier } from "./multiplier";

describe("multiplierAt — growth curve m(t) = 1 + (e^(0.085·t) − 1)", () => {
  it("pins curve values", () => {
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(0.5)).toBeCloseTo(1.0434160563736781, 12);
    expect(multiplierAt(1)).toBeCloseTo(1.0887170666983987, 12);
    expect(multiplierAt(2.5)).toBeCloseTo(1.2367661135652848, 12);
    expect(multiplierAt(5)).toBeCloseTo(1.5295904196633787, 12);
    expect(multiplierAt(10)).toBeCloseTo(2.3396468519259912, 12);
    expect(multiplierAt(20)).toBeCloseTo(5.4739473917272008, 12);
    expect(multiplierAt(30)).toBeCloseTo(12.807103782663035, 12);
    expect(multiplierAt(60)).toBeCloseTo(164.02190729990184, 10);
  });

  it("is strictly increasing", () => {
    let prev = multiplierAt(0);
    for (let t = 1; t <= 120; t++) {
      const m = multiplierAt(t);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });
});

describe("timeForMultiplier — inverse of the growth curve", () => {
  it("pins values", () => {
    expect(timeForMultiplier(1)).toBe(0);
    expect(timeForMultiplier(1.5)).toBeCloseTo(4.7701777424489924, 12);
    expect(timeForMultiplier(2)).toBeCloseTo(8.1546727124699441, 12);
    expect(timeForMultiplier(5)).toBeCloseTo(18.934563675695298, 12);
    expect(timeForMultiplier(10)).toBeCloseTo(27.089236388165244, 12);
    expect(timeForMultiplier(100)).toBeCloseTo(54.178472776330487, 12);
    expect(timeForMultiplier(200)).toBeCloseTo(62.333145488800426, 12);
  });

  it("round-trips with multiplierAt", () => {
    for (const m of [1.01, 1.5, 2, 5, 10, 50, 199]) {
      expect(multiplierAt(timeForMultiplier(m))).toBeCloseTo(m, 10);
    }
  });
});
