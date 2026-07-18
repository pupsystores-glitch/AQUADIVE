// Transition-sequence + command tests for the round state machine
// (Sprint 3, Commits E4–E5; the §20 risk-1 mitigation: transition-sequence
// tests on a seeded engine). Driven through the GameEngine facade so the
// clock, command queue, machine, simulation and event dispatch are
// exercised together. Since E5 the diving pipeline is the real
// DiveSimulation on a deterministic world Rng (constant 0.5 → seahorses at
// x = 0.5, never a goldfish, so boost stays 0 and the multiplier is exactly
// multiplierAt(diveElapsed)); dive outcomes are forced through the scripted
// authority's crash point (1 → crash on the first diving tick; huge → ride
// to the sea floor). All durations are pinned in whole ticks (§8
// quantization): betting 5 s = 300, crash banner 2.4 s = 144,
// impact→chests 1.4 s = 84, chest result 2.2 s = 132.
import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "./clock";
import { multiplierAt } from "./domain/multiplier";
import type { BonusChest } from "./domain/outcomes";
import type { EngineEventMap } from "./events";
import { GameEngine } from "./game-engine";
import type { RoundAuthority } from "./round-authority";
import { ENGINE_STATE_TO_PHASE } from "./state-machine";

const BETTING_TICKS = 300;
const CRASH_BANNER_TICKS = 144;
const IMPACT_TICKS = 84;
const CHEST_RESULT_TICKS = 132;

/** Crash point that can never be reached — forces the sea-floor path. */
const NEVER_CRASH = 1e9;

const CHESTS: [BonusChest, BonusChest, BonusChest] = [
  { id: 0, multiplier: 2, opened: false },
  { id: 1, multiplier: 6.5, opened: false },
  { id: 2, multiplier: 30, opened: false },
];

/** A seeded harness: scripted authority + constant-draw world Rng. */
function makeHarness(opts: { crashPoint?: number } = {}) {
  const calls = { crashPoint: 0, jackpot: 0, chests: 0 };
  const authority: RoundAuthority = {
    sampleCrashPoint: () => {
      calls.crashPoint++;
      return opts.crashPoint ?? 2.5;
    },
    sampleJackpot: () => {
      calls.jackpot++;
      return 120;
    },
    rollBonusChests: () => {
      calls.chests++;
      return CHESTS;
    },
  };
  const engine = new GameEngine({ authority, worldRng: { next: () => 0.5 } });
  const log: Array<{ name: keyof EngineEventMap; payload: unknown }> = [];
  const record = <K extends keyof EngineEventMap>(name: K) =>
    engine.events.on(name, (payload) => log.push({ name, payload }));
  record("bettingOpened");
  record("betPlaced");
  record("diveStarted");
  record("cashedOut");
  record("crashed");
  record("shipImpact");
  record("chestsRevealed");
  record("chestPicked");
  record("roundEnded");
  record("stateChanged");
  record("commandRejected");
  return { engine, calls, log };
}

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

describe("round state machine — §5 transition table on the simulation clock (D1)", () => {
  it("runs betting for exactly 300 ticks, then enters diving via the authority", () => {
    const h = makeHarness();
    expect(h.engine.state).toBe("betting");

    advanceTicks(h.engine, BETTING_TICKS - 1);
    expect(h.engine.state).toBe("betting");
    expect(h.engine.countdown).toBeCloseTo(TICK_SECONDS, 12);
    expect(h.engine.worldY).toBe(0); // pipeline never runs outside diving

    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("diving");
    expect(h.calls.crashPoint).toBe(1); // entry(diving) asked the authority once
    expect(h.log.filter((e) => e.name === "diveStarted")).toEqual([
      { name: "diveStarted", payload: { roundId: 1 } },
    ]);

    advanceTicks(h.engine, 2); // pipeline runs once per tick while diving
    expect(h.engine.worldY).toBeGreaterThan(0);
    expect(h.engine.multiplier).toBeCloseTo(multiplierAt(2 * TICK_SECONDS), 12);
  });

  it("crash path: pipeline outcome → crashed (144 ticks) → betting; world frozen outside diving (D3)", () => {
    // crashAt = 1: multiplierAt(1 tick) ≥ 1 → the first diving tick crashes,
    // before the descent step ran (D3 terminal exit) — worldY stays 0.
    const h = makeHarness({ crashPoint: 1 });
    advanceTicks(h.engine, BETTING_TICKS); // → diving
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("crashed");
    expect(h.engine.worldY).toBe(0);
    expect(h.engine.multiplier).toBe(1); // entry(crashed) clamps to crashAt
    expect(h.log.filter((e) => e.name === "crashed")).toEqual([
      { name: "crashed", payload: { roundId: 1, multiplier: 1 } },
    ]);

    advanceTicks(h.engine, CRASH_BANNER_TICKS - 1);
    expect(h.engine.state).toBe("crashed");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("betting");
    expect(h.engine.worldY).toBe(0); // no pipeline outside diving
    expect(h.engine.countdown).toBe(5);
    expect(h.log.filter((e) => e.name === "roundEnded")).toEqual([
      { name: "roundEnded", payload: { roundId: 1, outcome: "crashed" } },
    ]);
    expect(h.log.filter((e) => e.name === "bettingOpened")).toEqual([
      { name: "bettingOpened", payload: { roundId: 2 } }, // next round's id
    ]);
  });

  it("jackpot path: sea floor → impact (84 ticks) → bonus (waits forever) → pick → result → betting", () => {
    const h = makeHarness({ crashPoint: NEVER_CRASH });
    advanceTicks(h.engine, BETTING_TICKS); // → diving

    advanceUntil(h.engine, 5000, () => h.engine.state !== "diving");
    expect(h.engine.state).toBe("impact");
    expect(h.engine.worldY).toBeGreaterThanOrEqual(4200); // CHAIN_MAX_DEPTH reached
    expect(h.calls.jackpot).toBe(1);
    expect(h.engine.multiplier).toBe(120); // jackpot locked at entry(impact)
    expect(h.log.filter((e) => e.name === "shipImpact")).toEqual([
      { name: "shipImpact", payload: { roundId: 1, jackpotMultiplier: 120 } },
    ]);

    advanceTicks(h.engine, IMPACT_TICKS - 1);
    expect(h.engine.state).toBe("impact");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("bonus");
    expect(h.calls.chests).toBe(1);
    expect(h.log.filter((e) => e.name === "chestsRevealed")).toEqual([
      { name: "chestsRevealed", payload: { roundId: 1, chests: CHESTS } },
    ]);

    advanceTicks(h.engine, 1000); // no timeout: an unpicked chest waits forever (§5)
    expect(h.engine.state).toBe("bonus");

    // D4: the pick is a queued command, applied at the next tick boundary.
    h.engine.submit({ type: "pickChest", chestId: 1 });
    expect(h.log.filter((e) => e.name === "chestPicked")).toEqual([]); // not yet applied
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "chestPicked")).toEqual([
      {
        name: "chestPicked",
        payload: { roundId: 1, chestId: 1, chestMultiplier: 6.5, finalMultiplier: 780 }, // +(120·6.5).toFixed(2)
      },
    ]);
    expect(h.engine.multiplier).toBe(780); // chest final locked
    expect(h.engine.state).toBe("bonus"); // result interval still showing

    // The result timer starts at the applying tick boundary and counts that
    // tick, so betting arrives 132 ticks after the submit was consumed.
    advanceTicks(h.engine, CHEST_RESULT_TICKS - 2);
    expect(h.engine.state).toBe("bonus");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("betting");
    expect(h.log.filter((e) => e.name === "roundEnded")).toEqual([
      { name: "roundEnded", payload: { roundId: 1, outcome: "jackpot" } },
    ]);
  });

  it("projects engine states onto the fixed renderer Phase strings (§5)", () => {
    expect(ENGINE_STATE_TO_PHASE).toEqual({
      betting: "idle",
      diving: "diving",
      crashed: "crashed",
      impact: "cashed",
      bonus: "bonus",
    });
  });
});

describe("command queue — §13 validation at the applying tick (D4, §18 ring 1)", () => {
  it("accepts one placeBet per round while betting; rejects the rest", () => {
    const h = makeHarness();
    h.engine.submit({ type: "placeBet", amount: 25 });
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "betPlaced")).toEqual([
      { name: "betPlaced", payload: { roundId: 1, amount: 25 } },
    ]);

    h.engine.submit({ type: "placeBet", amount: 10 });
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "commandRejected")).toEqual([
      {
        name: "commandRejected",
        payload: {
          roundId: 1,
          command: { type: "placeBet", amount: 10 },
          reason: "already-participating",
        },
      },
    ]);
  });

  it("rejects non-positive bet amounts and bets outside the betting window", () => {
    const h = makeHarness();
    h.engine.submit({ type: "placeBet", amount: 0 });
    advanceTicks(h.engine, 1);
    advanceTicks(h.engine, BETTING_TICKS); // → diving (betting had already spent 1 tick)
    expect(h.engine.state).toBe("diving");
    h.engine.submit({ type: "placeBet", amount: 5 });
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "commandRejected").map((e) => e.payload)).toEqual([
      { roundId: 1, command: { type: "placeBet", amount: 0 }, reason: "invalid-amount" },
      { roundId: 1, command: { type: "placeBet", amount: 5 }, reason: "not-in-betting" },
    ]);
  });

  it("cashOut uses the tick-authoritative multiplier from the last completed tick (D4)", () => {
    const h = makeHarness({ crashPoint: NEVER_CRASH });
    h.engine.submit({ type: "placeBet", amount: 25 });
    advanceTicks(h.engine, BETTING_TICKS); // consumes the bet tick + reaches diving
    expect(h.engine.state).toBe("diving");

    advanceTicks(h.engine, 10);
    const tickAuthoritative = multiplierAt(10 * TICK_SECONDS);
    expect(h.engine.multiplier).toBeCloseTo(tickAuthoritative, 12);

    h.engine.submit({ type: "cashOut" });
    advanceTicks(h.engine, 1);
    const cashedOut = h.log.filter((e) => e.name === "cashedOut");
    expect(cashedOut).toHaveLength(1);
    // Applied before the tick's pipeline ran: the payload carries the last
    // completed tick's multiplier, while the engine has already moved on.
    expect((cashedOut[0].payload as { multiplier: number }).multiplier).toBeCloseTo(
      tickAuthoritative,
      12,
    );
    expect(h.engine.multiplier).toBeCloseTo(multiplierAt(11 * TICK_SECONDS), 12);
    expect(h.engine.state).toBe("diving"); // §5: cashout is not a transition
  });

  it("rejects cashOut when not diving, not participating, or already cashed out", () => {
    const h = makeHarness({ crashPoint: NEVER_CRASH });
    h.engine.submit({ type: "cashOut" }); // still betting
    advanceTicks(h.engine, 1);

    advanceTicks(h.engine, BETTING_TICKS - 1); // → diving, no bet placed
    h.engine.submit({ type: "cashOut" });
    advanceTicks(h.engine, 1);

    const reasons = () =>
      h.log
        .filter((e) => e.name === "commandRejected")
        .map((e) => (e.payload as { reason: string }).reason);
    expect(reasons()).toEqual(["not-diving", "not-participating"]);
    expect(h.log.filter((e) => e.name === "cashedOut")).toEqual([]);
  });

  it("applies queued commands in submit order within one boundary: second cashOut rejected", () => {
    const h = makeHarness({ crashPoint: NEVER_CRASH });
    h.engine.submit({ type: "placeBet", amount: 25 });
    advanceTicks(h.engine, BETTING_TICKS);
    advanceTicks(h.engine, 5);

    h.engine.submit({ type: "cashOut" });
    h.engine.submit({ type: "cashOut" }); // double-click inside one tick
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "cashedOut")).toHaveLength(1);
    expect(h.log.filter((e) => e.name === "commandRejected").map((e) => e.payload)).toEqual([
      { roundId: 1, command: { type: "cashOut" }, reason: "already-cashed-out" },
    ]);
  });

  it("rejects invalid pickChest commands and reports them without state change", () => {
    const h = makeHarness({ crashPoint: NEVER_CRASH });
    h.engine.submit({ type: "pickChest", chestId: 0 }); // still in betting
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("betting");
    expect(h.log.filter((e) => e.name === "commandRejected")).toEqual([
      {
        name: "commandRejected",
        payload: {
          roundId: 1,
          command: { type: "pickChest", chestId: 0 },
          reason: "not-in-bonus",
        },
      },
    ]);

    // Reach bonus, then pick twice inside one tick: first stands, second rejected.
    advanceTicks(h.engine, BETTING_TICKS - 1);
    advanceUntil(h.engine, 5000, () => h.engine.state !== "diving");
    advanceTicks(h.engine, IMPACT_TICKS);
    expect(h.engine.state).toBe("bonus");
    h.engine.submit({ type: "pickChest", chestId: 0 });
    h.engine.submit({ type: "pickChest", chestId: 2 });
    advanceTicks(h.engine, 1);
    const rejections = h.log.filter((e) => e.name === "commandRejected");
    expect(rejections).toHaveLength(2);
    expect(rejections[1].payload).toEqual({
      roundId: 1,
      command: { type: "pickChest", chestId: 2 },
      reason: "chest-already-picked",
    });
    expect(h.log.filter((e) => e.name === "chestPicked")).toHaveLength(1); // first pick stood
  });

  it("clears the participant at entry(betting): a new bet is accepted next round", () => {
    const h = makeHarness({ crashPoint: 1 });
    h.engine.submit({ type: "placeBet", amount: 25 });
    advanceTicks(h.engine, BETTING_TICKS); // bet applied; → diving
    advanceTicks(h.engine, 1); // first diving tick crashes (crashAt = 1)
    advanceTicks(h.engine, CRASH_BANNER_TICKS); // → betting (round 2)
    expect(h.engine.state).toBe("betting");

    h.engine.submit({ type: "placeBet", amount: 50 });
    advanceTicks(h.engine, 1);
    expect(h.log.filter((e) => e.name === "betPlaced").map((e) => e.payload)).toEqual([
      { roundId: 1, amount: 25 },
      { roundId: 2, amount: 50 },
    ]);
  });
});
