// Tests for the engine's fixed-tick accumulator (docs/06 §7, sanctioned
// delta D2) and the post-tick event dispatch hook (§12). Transition
// behavior of the round state machine is covered in state-machine.test.ts.
import { describe, expect, it } from "vitest";
import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import { GameEngine, type GameEngineDeps } from "./game-engine";
import type { RoundAuthority } from "./round-authority";

const stubAuthority = (): RoundAuthority => ({
  sampleCrashPoint: () => 2,
  sampleJackpot: () => 100,
  rollBonusChests: () => [
    { id: 0, multiplier: 2, opened: false },
    { id: 1, multiplier: 6.5, opened: false },
    { id: 2, multiplier: 30, opened: false },
  ],
});

const makeEngine = (divingTick: GameEngineDeps["divingTick"] = () => {}) =>
  new GameEngine({ authority: stubAuthority(), divingTick });

describe("GameEngine.advance — fixed 60 Hz tick accumulator (§7)", () => {
  it("consumes whole ticks with dt = TICK_SECONDS and carries the sub-tick remainder", () => {
    const engine = makeEngine();
    engine.advance(TICK_SECONDS); // exactly one tick
    expect(engine.tickCount).toBe(1);
    engine.advance(0.008); // sub-tick: accumulates, no tick
    expect(engine.tickCount).toBe(1);
    engine.advance(0.009); // 0.008 + 0.009 ≥ 1/60 → one tick
    expect(engine.tickCount).toBe(2);
    expect(engine.simTime).toBeCloseTo(2 * TICK_SECONDS, 12);
  });

  it("ticks 0 times on fast frames and multiple times on slow frames", () => {
    const engine = makeEngine();
    engine.advance(0.007); // 144 Hz-style frame
    expect(engine.tickCount).toBe(0);
    engine.advance(0.0334); // 30 Hz-style frame: 0.0404 accumulated → 2 ticks
    expect(engine.tickCount).toBe(2);
  });

  it("caps catch-up at MAX_TICKS_PER_ADVANCE and drops the excess (tab switch resumes, never fast-forwards)", () => {
    const engine = makeEngine();
    engine.advance(2.5); // tab-away: 150 ticks owed
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE);

    // The backlog was dropped entirely: nothing left in the accumulator.
    engine.advance(0.01);
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE);
    engine.advance(0.01); // 0.02 accumulated → exactly one more tick
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE + 1);
  });

  it("advances the machine clock per tick: countdown decrements on the simulation clock (D1)", () => {
    const engine = makeEngine();
    expect(engine.state).toBe("betting");
    expect(engine.countdown).toBe(5);
    for (let i = 0; i < 60; i++) engine.advance(TICK_SECONDS); // one simulated second
    expect(engine.countdown).toBeCloseTo(4, 12);
    expect(engine.state).toBe("betting");
  });

  it("is deterministic: identical advance sequences produce identical clocks and state", () => {
    const run = () => {
      const engine = makeEngine();
      for (const dt of [0.007, 0.021, 0.0166, 0.05, 0.001, 0.0333, 1.7, 0.016]) {
        engine.advance(dt);
      }
      return {
        tickCount: engine.tickCount,
        simTime: engine.simTime,
        state: engine.state,
        countdown: engine.countdown,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe("GameEngine — post-tick event dispatch (§12)", () => {
  it("delivers queued events only after the tick completes, never synchronously", () => {
    const seen: number[] = [];
    const engine = makeEngine();
    engine.events.on("diveStarted", (payload) => seen.push(payload.roundId));

    engine.events.emit("diveStarted", { roundId: 1 });
    expect(seen).toEqual([]); // queued, not dispatched — no tick has completed

    engine.advance(TICK_SECONDS);
    expect(seen).toEqual([1]);
  });
});
