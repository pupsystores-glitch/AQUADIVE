// Tests for the engine's fixed-tick accumulator (docs/06 §7, sanctioned
// delta D2), the facade's command/event edges (§12, §13; delta D4 —
// commands apply at the next tick boundary), and the E6 projections
// (§14/§15: getRenderState / getRenderTime / getPublicState). Transition
// and command *validation* behavior is covered in state-machine.test.ts;
// the diving pipeline itself in simulation.test.ts; snapshot()/restore()
// in snapshot.test.ts.
import { describe, expect, it } from "vitest";
import { CHAIN_MAX_DEPTH } from "@/shared/world";
import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import { GameEngine } from "./game-engine";
import type { RoundAuthority } from "./round-authority";

const stubAuthority = (crashPoint: number): RoundAuthority => ({
  sampleCrashPoint: () => crashPoint,
  sampleJackpot: () => 100,
  rollBonusChests: () => [
    { id: 0, multiplier: 2, opened: false },
    { id: 1, multiplier: 6.5, opened: false },
    { id: 2, multiplier: 30, opened: false },
  ],
});

const makeEngine = (crashPoint = 2) =>
  new GameEngine({ authority: stubAuthority(crashPoint), worldRng: { next: () => 0.5 } });

const BETTING_TICKS = 300;

const advanceTicks = (engine: GameEngine, n: number) => {
  for (let i = 0; i < n; i++) engine.advance(TICK_SECONDS);
};

/** Advance until the predicate holds; throws if `cap` ticks pass first. */
const advanceUntil = (engine: GameEngine, cap: number, done: () => boolean) => {
  for (let i = 0; i < cap; i++) {
    engine.advance(TICK_SECONDS);
    if (done()) return;
  }
  throw new Error(`condition not reached within ${cap} ticks`);
};

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
    expect(engine.getPublicState().countdownSeconds).toBe(5);
    for (let i = 0; i < 60; i++) engine.advance(TICK_SECONDS); // one simulated second
    expect(engine.getPublicState().countdownSeconds).toBeCloseTo(4, 12);
    expect(engine.state).toBe("betting");
  });

  it("is deterministic: identical advance + command sequences produce identical snapshots (§7, §14)", () => {
    const run = () => {
      const engine = makeEngine();
      engine.submit({ type: "placeBet", amount: 10 });
      for (const dt of [0.007, 0.021, 0.0166, 0.05, 0.001, 0.0333, 1.7, 0.016]) {
        engine.advance(dt);
      }
      return engine.snapshot();
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

describe("GameEngine — RenderState projection (§15: byte-compatible with docs/05 §4)", () => {
  it("projects the full shape at rest and while diving", () => {
    const engine = makeEngine();
    expect(engine.getRenderState()).toEqual({
      phase: "idle", // betting → "idle" via the fixed §5 map
      worldY: 0,
      depthRatio: 0,
      boost: 0,
      creatures: [],
      crashed: false,
      shipImpact: null,
    });

    advanceTicks(engine, BETTING_TICKS + 60); // one second into the dive
    const rs = engine.getRenderState();
    expect(rs.phase).toBe("diving");
    expect(rs.worldY).toBeGreaterThan(0);
    expect(rs.depthRatio).toBeCloseTo(rs.worldY / CHAIN_MAX_DEPTH, 12);
    expect(rs.creatures.length).toBeGreaterThan(0);
    expect(rs.crashed).toBe(false);
  });

  it("flags crashed while in the crashed state", () => {
    const engine = makeEngine(1); // crash on the first diving tick
    advanceTicks(engine, BETTING_TICKS + 1);
    const rs = engine.getRenderState();
    expect(rs.phase).toBe("crashed");
    expect(rs.crashed).toBe(true);
  });

  it("computes shipImpact.elapsed on the simulation clock from entry(impact) (§8)", () => {
    const engine = makeEngine(1e9); // never crashes → sea-floor path
    advanceTicks(engine, BETTING_TICKS);
    advanceUntil(engine, 5000, () => engine.state !== "diving");
    expect(engine.state).toBe("impact");
    expect(engine.getRenderState().shipImpact).toEqual({ elapsed: 0 }); // impactAt = this tick

    advanceTicks(engine, 30);
    expect(engine.getRenderState().shipImpact?.elapsed).toBeCloseTo(30 * TICK_SECONDS, 12);

    // Through bonus and back to betting the field clears with the round.
    advanceTicks(engine, 84 - 30); // impact → bonus
    expect(engine.state).toBe("bonus");
    engine.submit({ type: "pickChest", chestId: 0 });
    advanceTicks(engine, 1 + 132); // pick + result interval → betting
    expect(engine.state).toBe("betting");
    expect(engine.getRenderState().shipImpact).toBeNull();
  });
});

describe("GameEngine — RenderTime + public-state projections (§13, D5)", () => {
  it("getRenderTime: animTime is the simulation clock; frameDt is the clamped last wall delta", () => {
    const engine = makeEngine();
    expect(engine.getRenderTime()).toEqual({ animTime: 0, frameDt: 0 });

    engine.advance(0.007); // sub-tick frame: no tick consumed, frameDt still reported
    expect(engine.getRenderTime()).toEqual({ animTime: 0, frameDt: 0.007 });

    engine.advance(2.5); // tab-away frame: clamped to the 0.05 s renderer contract value
    expect(engine.getRenderTime().frameDt).toBe(0.05);
    expect(engine.getRenderTime().animTime).toBeCloseTo(engine.simTime, 12);
  });

  it("getPublicState: the HUD's per-frame read, participant included", () => {
    const engine = makeEngine();
    expect(engine.getPublicState()).toEqual({
      phase: "idle",
      roundId: 1,
      countdownSeconds: 5,
      multiplier: 1,
      boost: 0,
      participant: null,
      chests: null,
      chosenChestId: null,
    });

    engine.submit({ type: "placeBet", amount: 25 });
    advanceTicks(engine, 1);
    expect(engine.getPublicState().participant).toEqual({
      betAmount: 25,
      cashedOut: false,
      cashedOutAt: null,
    });

    advanceTicks(engine, BETTING_TICKS - 1); // → diving
    advanceTicks(engine, 10); // let the multiplier grow past 1
    engine.submit({ type: "cashOut" });
    advanceTicks(engine, 1);
    const ps = engine.getPublicState();
    expect(ps.phase).toBe("diving"); // §5: cashout is not a transition
    expect(ps.participant?.cashedOut).toBe(true);
    expect(ps.participant?.cashedOutAt).toBeGreaterThan(1);
  });

  it("getPublicState: chests and the chosen chest id surface in bonus", () => {
    const engine = makeEngine(1e9);
    advanceTicks(engine, BETTING_TICKS);
    advanceUntil(engine, 5000, () => engine.state !== "diving");
    advanceTicks(engine, 84); // impact → bonus
    let ps = engine.getPublicState();
    expect(ps.phase).toBe("bonus");
    expect(ps.chests).toHaveLength(3);
    expect(ps.chosenChestId).toBeNull();

    engine.submit({ type: "pickChest", chestId: 2 });
    advanceTicks(engine, 1);
    ps = engine.getPublicState();
    expect(ps.chosenChestId).toBe(2);
    expect(ps.multiplier).toBe(+(100 * 30).toFixed(2)); // jackpot × chest, locked
  });
});
