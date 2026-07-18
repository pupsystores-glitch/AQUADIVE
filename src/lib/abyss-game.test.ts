// Characterization tests for the pure game math (Sprint 3, Commit E1;
// docs/06_ENGINE_ARCHITECTURE.md §21 step E1, §20 risk 1).
//
// These pin the CURRENT behavior — golden values computed from today's
// implementation — before any engine extraction moves this code. A failure
// here means behavior drifted: the commit that caused it stops (only the
// sanctioned deltas D1–D5 may change behavior, and none touch these
// functions). The known economics flaws (TASK 001) are pinned on purpose;
// rebalance is a separate approved task.
//
// Randomized functions are pinned two ways: exact branch/arithmetic mapping
// with a stubbed Math.random sequence (deterministic), plus hard bounds over
// many real draws (clamps, never statistical frequencies — no flakiness).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chainTier,
  descentSpeed,
  formatMultiplier,
  multiplierAt,
  rollBonusChests,
  sampleCrashPoint,
  timeForMultiplier,
} from "@/lib/abyss-game";

/** Stub Math.random to return the given draws in order. */
function mockRandom(...draws: number[]) {
  const spy = vi.spyOn(Math, "random");
  for (const d of draws) spy.mockReturnValueOnce(d);
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("descentSpeed — 120 + min(520, m^0.95 · 28) px/s", () => {
  it("pins values below the cap", () => {
    expect(descentSpeed(1)).toBe(148);
    expect(descentSpeed(1.5)).toBeCloseTo(161.15709634312742, 12);
    expect(descentSpeed(2)).toBeCloseTo(174.09243441979135, 12);
    expect(descentSpeed(5)).toBeCloseTo(249.17531684268235, 12);
    expect(descentSpeed(10)).toBeCloseTo(369.5502626774487, 12);
    expect(descentSpeed(21)).toBeCloseTo(624.97091119004654, 12);
  });

  it("caps at 640 px/s from m ≈ 21.66 onward", () => {
    expect(descentSpeed(21.658413677550236)).toBeCloseTo(640, 9);
    expect(descentSpeed(22)).toBe(640);
    expect(descentSpeed(50)).toBe(640);
    expect(descentSpeed(200)).toBe(640);
    expect(descentSpeed(1000)).toBe(640);
  });
});

describe("formatMultiplier", () => {
  it("pins toFixed(2) + '×' formatting, including float artifacts", () => {
    expect(formatMultiplier(1)).toBe("1.00×");
    expect(formatMultiplier(1.005)).toBe("1.00×"); // toFixed float artifact, pinned as-is
    expect(formatMultiplier(2.5)).toBe("2.50×");
    expect(formatMultiplier(12.345)).toBe("12.35×");
    expect(formatMultiplier(200)).toBe("200.00×");
  });
});

describe("chainTier — bet-size tier table", () => {
  it("pins the band boundaries", () => {
    expect(chainTier(0)).toBe("rope");
    expect(chainTier(1)).toBe("rope");
    expect(chainTier(4.99)).toBe("rope");
    expect(chainTier(5)).toBe("chain");
    expect(chainTier(10)).toBe("chain");
    expect(chainTier(24.99)).toBe("chain");
    expect(chainTier(25)).toBe("heavy");
    expect(chainTier(100)).toBe("heavy");
  });
});

describe("sampleCrashPoint — clamp(0.99 / (1 − u), 1.01, 200) with a 3% instant-crash branch", () => {
  it("returns exactly 1.0 on the house-edge branch (r < 0.03), consuming one draw", () => {
    const spy = mockRandom(0);
    expect(sampleCrashPoint()).toBe(1.0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("pins the branch boundary at r = 0.03", () => {
    mockRandom(0.0299999);
    expect(sampleCrashPoint()).toBe(1.0);
    mockRandom(0.03, 0.5);
    expect(sampleCrashPoint()).toBeCloseTo(1.98, 12);
  });

  it("pins the u → multiplier mapping", () => {
    mockRandom(0.5, 0);
    expect(sampleCrashPoint()).toBe(1.01); // lower clamp
    mockRandom(0.5, 0.25);
    expect(sampleCrashPoint()).toBeCloseTo(1.32, 12);
    mockRandom(0.5, 0.9);
    expect(sampleCrashPoint()).toBeCloseTo(9.9, 12);
    mockRandom(0.5, 0.99);
    expect(sampleCrashPoint()).toBeCloseTo(99, 10);
    mockRandom(0.5, 0.999);
    expect(sampleCrashPoint()).toBe(200); // upper clamp
  });

  it("always stays within [1, 200], and never in (1, 1.01)", () => {
    for (let i = 0; i < 10000; i++) {
      const m = sampleCrashPoint();
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(200);
      if (m !== 1.0) expect(m).toBeGreaterThanOrEqual(1.01);
    }
  });
});

describe("rollBonusChests — three chests from the 60/32/8 band table", () => {
  it("pins the band arithmetic (small / medium / big) and chest structure", () => {
    // Each chest consumes two draws: band selector r, then range position.
    mockRandom(0, 0.5, 0.6, 0.5, 0.92, 0.5);
    expect(rollBonusChests()).toEqual([
      { id: 0, multiplier: 2, opened: false }, // small: 1 + 0.5·2
      { id: 1, multiplier: 6.5, opened: false }, // medium: 3 + 0.5·7
      { id: 2, multiplier: 30, opened: false }, // big: 10 + 0.5·40
    ]);
  });

  it("pins the band boundaries at r = 0.6 and r = 0.92", () => {
    mockRandom(0.5999999, 0.5, 0.9199999, 0.5, 0.9999999, 0.5);
    expect(rollBonusChests()).toEqual([
      { id: 0, multiplier: 2, opened: false }, // still small
      { id: 1, multiplier: 6.5, opened: false }, // still medium
      { id: 2, multiplier: 30, opened: false }, // big
    ]);
  });

  it("rounds multipliers to two decimals", () => {
    mockRandom(0, 0.123456, 0, 0.5, 0, 0.5);
    const [first] = rollBonusChests();
    expect(first.multiplier).toBe(1.25); // 1 + 0.123456·2 = 1.246912 → 1.25
  });

  it("always yields three unopened chests with ids 0/1/2 and multipliers in [1, 50] at 2 decimals", () => {
    for (let i = 0; i < 2000; i++) {
      const chests = rollBonusChests();
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
