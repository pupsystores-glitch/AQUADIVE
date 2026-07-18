// Characterization tests for rollCreature — the depth-banded kind table and
// creature attribute rolls (Sprint 3, Commit E2). Pinned in the commit that
// extracts them from the spawnCreature closure in AbyssAnchor.tsx, exactly
// as recorded in docs/16_CURRENT_TASK.md (the table was unreachable by
// tests while a component closure). Bands, thresholds and attribute
// arithmetic are the CURRENT values, moved verbatim.
//
// Depth bands (depthRatio = min(1, worldY / 4200)):
//   shallow  depthRatio < 0.25  → worldY < 1050
//   mid      depthRatio < 0.6   → worldY < 2520
//   deep     otherwise
import { describe, expect, it } from "vitest";
import type { CreatureKind } from "@/shared/creatures";
import { seq } from "../test/sequence-rng";
import { rollCreature } from "./creatures";

/** Roll at (worldY, kind-draw r) with fixed mid-range attribute draws. */
const kindAt = (worldY: number, r: number): CreatureKind =>
  rollCreature(worldY, 1, seq(r, 0.5, 0.5, 0.5, 0.5, 0.5)).kind;

describe("rollCreature — attribute rolls (six draws, fixed order)", () => {
  it("pins the draw order and arithmetic: kind, x, worldY, size, phase, dir", () => {
    const rng = seq(0, 0.5, 0.5, 0.5, 0.5, 0.4);
    expect(rollCreature(0, 7, rng)).toEqual({
      id: 7,
      kind: "fishSchool", // shallow band, r = 0
      x: 0.5, // 0.1 + 0.5·0.8
      worldY: 240, // 0 + 200 + 0.5·80
      size: 1.1, // 0.8 + 0.5·0.6
      phase: Math.PI, // 0.5·π·2
      dir: 1, // 0.4 < 0.5
    });
    expect(rng.calls).toBe(6);
  });

  it("pins the dir threshold at 0.5 and attribute ranges", () => {
    expect(rollCreature(0, 1, seq(0, 0, 0, 0, 0, 0.5)).dir).toBe(-1); // 0.5 is not < 0.5
    const low = rollCreature(1000, 2, seq(0, 0, 0, 0, 0, 0));
    expect(low.x).toBeCloseTo(0.1, 12);
    expect(low.worldY).toBe(1200); // spawn worldY + 200
    expect(low.size).toBeCloseTo(0.8, 12);
    expect(low.phase).toBe(0);
    expect(low.consumed).toBeUndefined();
  });
});

describe("rollCreature — shallow band kind table (depthRatio < 0.25)", () => {
  it("pins the thresholds 0.35 / 0.55 / 0.72 / 0.88 / 0.96", () => {
    expect(kindAt(0, 0)).toBe("fishSchool");
    expect(kindAt(0, 0.3499999)).toBe("fishSchool");
    expect(kindAt(0, 0.35)).toBe("seahorse");
    expect(kindAt(0, 0.5499999)).toBe("seahorse");
    expect(kindAt(0, 0.55)).toBe("jellyfish");
    expect(kindAt(0, 0.7199999)).toBe("jellyfish");
    expect(kindAt(0, 0.72)).toBe("kelp");
    expect(kindAt(0, 0.8799999)).toBe("kelp");
    expect(kindAt(0, 0.88)).toBe("fishSchool");
    expect(kindAt(0, 0.9599999)).toBe("fishSchool");
    expect(kindAt(0, 0.96)).toBe("goldfish");
    expect(kindAt(0, 0.9999999)).toBe("goldfish");
  });
});

describe("rollCreature — mid band kind table (0.25 ≤ depthRatio < 0.6)", () => {
  it("pins the thresholds 0.25 / 0.45 / 0.6 / 0.75 / 0.88 / 0.96", () => {
    expect(kindAt(1050, 0)).toBe("fishSchool");
    expect(kindAt(1050, 0.2499999)).toBe("fishSchool");
    expect(kindAt(1050, 0.25)).toBe("octopus");
    expect(kindAt(1050, 0.4499999)).toBe("octopus");
    expect(kindAt(1050, 0.45)).toBe("jellyfish");
    expect(kindAt(1050, 0.5999999)).toBe("jellyfish");
    expect(kindAt(1050, 0.6)).toBe("manta");
    expect(kindAt(1050, 0.7499999)).toBe("manta");
    expect(kindAt(1050, 0.75)).toBe("sealion");
    expect(kindAt(1050, 0.8799999)).toBe("sealion");
    expect(kindAt(1050, 0.88)).toBe("kelp");
    expect(kindAt(1050, 0.9599999)).toBe("kelp");
    expect(kindAt(1050, 0.96)).toBe("goldfish");
    expect(kindAt(1050, 0.9999999)).toBe("goldfish");
  });
});

describe("rollCreature — deep band kind table (depthRatio ≥ 0.6)", () => {
  it("pins the thresholds 0.2 / 0.4 / 0.62 / 0.78 / 0.9 / 0.96", () => {
    expect(kindAt(2520, 0)).toBe("octopus");
    expect(kindAt(2520, 0.1999999)).toBe("octopus");
    expect(kindAt(2520, 0.2)).toBe("sealion");
    expect(kindAt(2520, 0.3999999)).toBe("sealion");
    expect(kindAt(2520, 0.4)).toBe("whale");
    expect(kindAt(2520, 0.6199999)).toBe("whale");
    expect(kindAt(2520, 0.62)).toBe("anglerfish");
    expect(kindAt(2520, 0.7799999)).toBe("anglerfish");
    expect(kindAt(2520, 0.78)).toBe("manta");
    expect(kindAt(2520, 0.8999999)).toBe("manta");
    expect(kindAt(2520, 0.9)).toBe("jellyfish");
    expect(kindAt(2520, 0.9599999)).toBe("jellyfish");
    expect(kindAt(2520, 0.96)).toBe("goldfish");
    expect(kindAt(2520, 0.9999999)).toBe("goldfish");
  });

  it("pins the band edges: 1049→shallow, 1050→mid, 2519→mid, 2520→deep, and the depthRatio clamp", () => {
    expect(kindAt(1049, 0.35)).toBe("seahorse"); // still shallow table
    expect(kindAt(1050, 0.35)).toBe("octopus"); // mid table
    expect(kindAt(2519, 0.35)).toBe("octopus"); // still mid table
    expect(kindAt(2520, 0.35)).toBe("sealion"); // deep table
    expect(kindAt(999999, 0.35)).toBe("sealion"); // clamped to 1 → deep table
  });
});
