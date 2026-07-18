// Tests for the E3 engine skeleton: the fixed-tick accumulator (docs/06
// §7, sanctioned delta D2) and the post-tick event dispatch hook (§12).
// This is the seeded-engine determinism spot-check required by the §21
// validation gate from E3 onward, at E3's surface area: identical advance
// sequences must produce identical tick sequences and clocks.
import { describe, expect, it } from "vitest";
import { GameEngine, MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./game-engine";

describe("GameEngine.advance — fixed 60 Hz tick accumulator (§7)", () => {
  it("consumes whole ticks with dt = TICK_SECONDS and carries the sub-tick remainder", () => {
    const dts: number[] = [];
    const engine = new GameEngine({ tick: (dt) => dts.push(dt) });

    engine.advance(TICK_SECONDS); // exactly one tick
    expect(engine.tickCount).toBe(1);

    engine.advance(0.008); // sub-tick: accumulates, no tick
    expect(engine.tickCount).toBe(1);

    engine.advance(0.009); // 0.008 + 0.009 ≥ 1/60 → one tick
    expect(engine.tickCount).toBe(2);

    expect(dts).toEqual([TICK_SECONDS, TICK_SECONDS]);
    expect(engine.simTime).toBeCloseTo(2 * TICK_SECONDS, 12);
  });

  it("ticks 0 times on fast frames and multiple times on slow frames", () => {
    const engine = new GameEngine({ tick: () => {} });
    engine.advance(0.007); // 144 Hz-style frame
    expect(engine.tickCount).toBe(0);
    engine.advance(0.0334); // 30 Hz-style frame: 0.0404 accumulated → 2 ticks
    expect(engine.tickCount).toBe(2);
  });

  it("caps catch-up at MAX_TICKS_PER_ADVANCE and drops the excess (tab switch resumes, never fast-forwards)", () => {
    const engine = new GameEngine({ tick: () => {} });
    engine.advance(2.5); // tab-away: 150 ticks owed
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE);

    // The backlog was dropped entirely: nothing left in the accumulator.
    engine.advance(0.01);
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE);
    engine.advance(0.01); // 0.02 accumulated → exactly one more tick
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE + 1);
  });

  it("is deterministic: identical advance sequences produce identical tick traces", () => {
    const run = () => {
      const trace: number[] = [];
      const engine = new GameEngine({ tick: () => trace.push(engine.tickCount) });
      for (const dt of [0.007, 0.021, 0.0166, 0.05, 0.001, 0.0333, 1.7, 0.016]) {
        engine.advance(dt);
      }
      return { trace, tickCount: engine.tickCount, simTime: engine.simTime };
    };
    expect(run()).toEqual(run());
  });

  it("derives simTime from the tick count alone (§8)", () => {
    const engine = new GameEngine({ tick: () => {} });
    engine.advance(10); // capped at 3 ticks regardless of wall time fed
    expect(engine.simTime).toBeCloseTo(3 * TICK_SECONDS, 12);
    expect(engine.simTime).toBe(engine.tickCount * TICK_SECONDS);
  });
});

describe("GameEngine — post-tick event dispatch (§12)", () => {
  it("delivers queued events only after the tick completes, never synchronously", () => {
    const seen: number[] = [];
    const engine = new GameEngine({
      tick: () => engine.events.emit("diveStarted", { roundId: 42 }),
    });
    engine.events.on("diveStarted", (payload) => seen.push(payload.roundId));

    engine.events.emit("diveStarted", { roundId: 1 });
    expect(seen).toEqual([]); // queued, not dispatched — no tick has completed

    engine.advance(TICK_SECONDS); // one tick: drains the pre-queued event + the tick's own
    expect(seen).toEqual([1, 42]);
  });
});
