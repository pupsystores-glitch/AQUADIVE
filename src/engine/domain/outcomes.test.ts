// Characterization tests for the outcome distributions (pinned in E1 in
// src/lib/abyss-game.test.ts and src/components/AbyssAnchor.test.ts;
// migrated in E2 when the functions moved verbatim into the engine domain,
// sampleJackpot folded in per docs/06 §20 risk 5). Golden values unchanged;
// the Math.random stubs became injected Rng sequences (docs/06 §11). The
// known economics flaws (TASK 001) are pinned on purpose; rebalance is a
// separate approved task.
//
// Randomized functions are pinned two ways: exact branch/arithmetic mapping
// with a deterministic draw sequence, plus hard bounds over many real draws
// (clamps, never statistical frequencies — no flakiness).
import { describe, expect, it } from "vitest";
import { createMathRandomRng } from "../rng";
import { seq } from "../test/sequence-rng";
import { rollBonusChests, sampleCrashPoint, sampleJackpot } from "./outcomes";

describe("sampleCrashPoint — clamp(0.99 / (1 − u), 1.01, 200) with a 3% instant-crash branch", () => {
  it("returns exactly 1.0 on the house-edge branch (r < 0.03), consuming one draw", () => {
    const rng = seq(0);
    expect(sampleCrashPoint(rng)).toBe(1.0);
    expect(rng.calls).toBe(1);
  });

  it("pins the branch boundary at r = 0.03", () => {
    expect(sampleCrashPoint(seq(0.0299999))).toBe(1.0);
    expect(sampleCrashPoint(seq(0.03, 0.5))).toBeCloseTo(1.98, 12);
  });

  it("pins the u → multiplier mapping", () => {
    expect(sampleCrashPoint(seq(0.5, 0))).toBe(1.01); // lower clamp
    expect(sampleCrashPoint(seq(0.5, 0.25))).toBeCloseTo(1.32, 12);
    expect(sampleCrashPoint(seq(0.5, 0.9))).toBeCloseTo(9.9, 12);
    expect(sampleCrashPoint(seq(0.5, 0.99))).toBeCloseTo(99, 10);
    expect(sampleCrashPoint(seq(0.5, 0.999))).toBe(200); // upper clamp
  });

  it("always stays within [1, 200], and never in (1, 1.01)", () => {
    const rng = createMathRandomRng();
    for (let i = 0; i < 10000; i++) {
      const m = sampleCrashPoint(rng);
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(200);
      if (m !== 1.0) expect(m).toBeGreaterThanOrEqual(1.01);
    }
  });
});

describe("sampleJackpot — 50% → 50–100×, 35% → 100–200×, 15% → 200–500×", () => {
  it("pins the band arithmetic (band selector r, then range position)", () => {
    expect(sampleJackpot(seq(0, 0))).toBe(50);
    expect(sampleJackpot(seq(0.25, 0.5))).toBe(75); // 50 + 0.5·50
    expect(sampleJackpot(seq(0.5, 0.5))).toBe(150); // 100 + 0.5·100
    expect(sampleJackpot(seq(0.85, 0.5))).toBe(350); // 200 + 0.5·300
    expect(sampleJackpot(seq(0.9, 0.999))).toBe(499.7); // 200 + 0.999·300
  });

  it("pins the band boundaries at r = 0.5 and r = 0.85", () => {
    expect(sampleJackpot(seq(0.4999999, 0.5))).toBe(75); // still low band
    expect(sampleJackpot(seq(0.5, 0))).toBe(100);
    expect(sampleJackpot(seq(0.8499999, 0))).toBe(100); // still mid band
    expect(sampleJackpot(seq(0.85, 0))).toBe(200);
  });

  it("rounds to two decimals", () => {
    expect(sampleJackpot(seq(0, 0.123456))).toBe(56.17); // 50 + 0.123456·50 = 56.1728 → 56.17
  });

  it("always stays within [50, 500] at 2 decimals", () => {
    const rng = createMathRandomRng();
    for (let i = 0; i < 5000; i++) {
      const m = sampleJackpot(rng);
      expect(m).toBeGreaterThanOrEqual(50);
      expect(m).toBeLessThanOrEqual(500);
      expect(Math.abs(m * 100 - Math.round(m * 100))).toBeLessThan(1e-6);
    }
  });
});

describe("rollBonusChests — three chests from the 60/32/8 band table", () => {
  it("pins the band arithmetic (small / medium / big) and chest structure", () => {
    // Each chest consumes two draws: band selector r, then range position.
    expect(rollBonusChests(seq(0, 0.5, 0.6, 0.5, 0.92, 0.5))).toEqual([
      { id: 0, multiplier: 2, opened: false }, // small: 1 + 0.5·2
      { id: 1, multiplier: 6.5, opened: false }, // medium: 3 + 0.5·7
      { id: 2, multiplier: 30, opened: false }, // big: 10 + 0.5·40
    ]);
  });

  it("pins the band boundaries at r = 0.6 and r = 0.92", () => {
    expect(rollBonusChests(seq(0.5999999, 0.5, 0.9199999, 0.5, 0.9999999, 0.5))).toEqual([
      { id: 0, multiplier: 2, opened: false }, // still small
      { id: 1, multiplier: 6.5, opened: false }, // still medium
      { id: 2, multiplier: 30, opened: false }, // big
    ]);
  });

  it("rounds multipliers to two decimals", () => {
    const [first] = rollBonusChests(seq(0, 0.123456, 0, 0.5, 0, 0.5));
    expect(first.multiplier).toBe(1.25); // 1 + 0.123456·2 = 1.246912 → 1.25
  });

  it("always yields three unopened chests with ids 0/1/2 and multipliers in [1, 50] at 2 decimals", () => {
    const rng = createMathRandomRng();
    for (let i = 0; i < 2000; i++) {
      const chests = rollBonusChests(rng);
      expect(chests).toHaveLength(3);
      chests.forEach((chest, idx) => {
        expect(chest.id).toBe(idx);
        expect(chest.opened).toBe(false);
        expect(chest.multiplier).toBeGreaterThanOrEqual(1);
        expect(chest.multiplier).toBeLessThanOrEqual(50);
        expect(Math.abs(chest.multiplier * 100 - Math.round(chest.multiplier * 100))).toBeLessThan(
          1e-6,
        );
      });
    }
  });
});
