// Characterization test for the RoundAuthority seam (Sprint 3, Commit E2;
// docs/06 §16): LocalRoundAuthority draws every outcome from the injected
// `outcome` stream via the domain distributions — nothing else.
import { describe, expect, it } from "vitest";
import { LocalRoundAuthority } from "./round-authority";
import { seq } from "./test/sequence-rng";

describe("LocalRoundAuthority — binds the outcome distributions to the injected outcome stream", () => {
  it("draws crash point, jackpot and chests from the stream in order", () => {
    const rng = seq(0.5, 0.25, 0, 0.5, 0, 0.5, 0.6, 0.5, 0.92, 0.5);
    const authority = new LocalRoundAuthority(rng);
    expect(authority.sampleCrashPoint()).toBeCloseTo(1.32, 12); // 2 draws
    expect(authority.sampleJackpot()).toBe(75); // 2 draws
    expect(authority.rollBonusChests()).toEqual([
      { id: 0, multiplier: 2, opened: false },
      { id: 1, multiplier: 6.5, opened: false },
      { id: 2, multiplier: 30, opened: false },
    ]); // 6 draws
    expect(rng.calls).toBe(10);
  });
});
