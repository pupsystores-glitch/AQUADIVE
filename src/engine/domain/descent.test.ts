// Characterization tests for descent kinematics (pinned in E1 as part of
// src/lib/abyss-game.test.ts; imports migrated in E2 when the function
// moved verbatim to src/engine/domain/descent.ts). Golden values unchanged.
import { describe, expect, it } from "vitest";
import { descentSpeed } from "./descent";

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
