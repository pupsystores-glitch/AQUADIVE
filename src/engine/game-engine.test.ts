// Tests for the engine's fixed-tick accumulator (docs/06 §7, sanctioned
// delta D2) and the facade's command/event edges (§12, §13; delta D4 —
// commands apply at the next tick boundary). Transition and command
// *validation* behavior is covered in state-machine.test.ts; the diving
// pipeline itself in simulation.test.ts.
import { describe, expect, it } from "vitest";
import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import { GameEngine } from "./game-engine";
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

const makeEngine = () =>
  new GameEngine({ authority: stubAuthority(), worldRng: { next: () => 0.5 } });

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

  it("is deterministic: identical advance + command sequences produce identical state (§7)", () => {
    const run = () => {
      const engine = makeEngine();
      engine.submit({ type: "placeBet", amount: 10 });
      for (const dt of [0.007, 0.021, 0.0166, 0.05, 0.001, 0.0333, 1.7, 0.016]) {
        engine.advance(dt);
      }
      return {
        tickCount: engine.tickCount,
        simTime: engine.simTime,
        state: engine.state,
        countdown: engine.countdown,
        worldY: engine.worldY,
        multiplier: engine.multiplier,
        creatures: engine.creatures.length,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe("GameEngine — command queue at the tick boundary (§13, D4)", () => {
  it("applies a submitted command only when a tick is consumed, never at submit time", () => {
    const seen: number[] = [];
    const engine = makeEngine();
    engine.events.on("betPlaced", ({ amount }) => seen.push(amount));

    engine.submit({ type: "placeBet", amount: 25 });
    expect(seen).toEqual([]); // queued, not applied

    engine.advance(0.008); // sub-tick: no boundary crossed, still queued
    expect(seen).toEqual([]);

    engine.advance(0.009); // one tick consumed → applied + dispatched
    expect(seen).toEqual([25]);
  });

  it("defers commands submitted by event listeners to the next tick (§12: no reentrancy)", () => {
    const engine = makeEngine();
    const rejected: string[] = [];
    engine.events.on("betPlaced", () => {
      engine.submit({ type: "placeBet", amount: 99 }); // reentrant submit
    });
    engine.events.on("commandRejected", ({ reason }) => rejected.push(reason));

    engine.submit({ type: "placeBet", amount: 25 });
    engine.advance(TICK_SECONDS); // applies the bet; listener queues another
    expect(rejected).toEqual([]); // not applied in the same tick

    engine.advance(TICK_SECONDS); // next boundary: applied → rejected
    expect(rejected).toEqual(["already-participating"]);
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
