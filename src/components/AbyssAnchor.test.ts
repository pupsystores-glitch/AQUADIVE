// Characterization tests for sampleJackpot (Sprint 3, Commit E1;
// docs/06_ENGINE_ARCHITECTURE.md §21 step E1, §20 risk 1).
//
// The function is pinned here, in the component module where it still
// lives, before E2 moves it into the engine's RoundAuthority (§20 risk 5).
// Its RTP flaw (TASK 001) is pinned on purpose — the move must be verbatim.
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleJackpot } from "@/components/AbyssAnchor";

/** Stub Math.random to return the given draws in order. */
function mockRandom(...draws: number[]) {
  const spy = vi.spyOn(Math, "random");
  for (const d of draws) spy.mockReturnValueOnce(d);
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sampleJackpot — 50% → 50–100×, 35% → 100–200×, 15% → 200–500×", () => {
  it("pins the band arithmetic (band selector r, then range position)", () => {
    mockRandom(0, 0);
    expect(sampleJackpot()).toBe(50);
    mockRandom(0.25, 0.5);
    expect(sampleJackpot()).toBe(75); // 50 + 0.5·50
    mockRandom(0.5, 0.5);
    expect(sampleJackpot()).toBe(150); // 100 + 0.5·100
    mockRandom(0.85, 0.5);
    expect(sampleJackpot()).toBe(350); // 200 + 0.5·300
    mockRandom(0.9, 0.999);
    expect(sampleJackpot()).toBe(499.7); // 200 + 0.999·300
  });

  it("pins the band boundaries at r = 0.5 and r = 0.85", () => {
    mockRandom(0.4999999, 0.5);
    expect(sampleJackpot()).toBe(75); // still low band
    mockRandom(0.5, 0);
    expect(sampleJackpot()).toBe(100);
    mockRandom(0.8499999, 0);
    expect(sampleJackpot()).toBe(100); // still mid band
    mockRandom(0.85, 0);
    expect(sampleJackpot()).toBe(200);
  });

  it("rounds to two decimals", () => {
    mockRandom(0, 0.123456);
    expect(sampleJackpot()).toBe(56.17); // 50 + 0.123456·50 = 56.1728 → 56.17
  });

  it("always stays within [50, 500] at 2 decimals", () => {
    for (let i = 0; i < 5000; i++) {
      const m = sampleJackpot();
      expect(m).toBeGreaterThanOrEqual(50);
      expect(m).toBeLessThanOrEqual(500);
      expect(Math.abs(m * 100 - Math.round(m * 100))).toBeLessThan(1e-6);
    }
  });
});
