// Characterization tests for the UI presentation helpers (pinned in E1 as
// part of src/lib/abyss-game.test.ts; imports migrated in E2 when the
// functions moved verbatim to src/game/presentation.ts). Golden values
// unchanged.
import { describe, expect, it } from "vitest";
import { chainTier, formatMultiplier } from "@/game/presentation";

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
