// Transition-sequence tests for the round state machine (Sprint 3, Commit
// E4; the §20 risk-1 mitigation: "after the state machine lands,
// transition-sequence tests on a seeded engine"). Driven through the
// GameEngine facade so the clock, machine and event dispatch are exercised
// together. All durations are pinned in whole ticks (§8 quantization):
// betting 5 s = 300, crash banner 2.4 s = 144, impact→chests 1.4 s = 84,
// chest result 2.2 s = 132.
import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "./clock";
import type { BonusChest } from "./domain/outcomes";
import type { EngineEventMap } from "./events";
import { GameEngine } from "./game-engine";
import type { RoundAuthority } from "./round-authority";
import { ENGINE_STATE_TO_PHASE, type DivingTickOutcome } from "./state-machine";

const BETTING_TICKS = 300;
const CRASH_BANNER_TICKS = 144;
const IMPACT_TICKS = 84;
const CHEST_RESULT_TICKS = 132;

const CHESTS: [BonusChest, BonusChest, BonusChest] = [
  { id: 0, multiplier: 2, opened: false },
  { id: 1, multiplier: 6.5, opened: false },
  { id: 2, multiplier: 30, opened: false },
];

/** A seeded harness: scripted authority + controllable diving outcome. */
function makeHarness() {
  const calls = { crashPoint: 0, jackpot: 0, chests: 0 };
  const authority: RoundAuthority = {
    sampleCrashPoint: () => {
      calls.crashPoint++;
      return 2.5;
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
  let nextOutcome: DivingTickOutcome | undefined;
  let divingTickCalls = 0;
  const engine = new GameEngine({
    authority,
    divingTick: () => {
      divingTickCalls++;
      const outcome = nextOutcome;
      nextOutcome = undefined;
      return outcome;
    },
  });
  const log: Array<{ name: keyof EngineEventMap; payload: unknown }> = [];
  const record = <K extends keyof EngineEventMap>(name: K) =>
    engine.events.on(name, (payload) => log.push({ name, payload }));
  record("bettingOpened");
  record("diveStarted");
  record("crashed");
  record("shipImpact");
  record("chestsRevealed");
  record("chestPicked");
  record("roundEnded");
  record("stateChanged");
  record("commandRejected");
  return {
    engine,
    calls,
    log,
    setOutcome: (outcome: DivingTickOutcome) => {
      nextOutcome = outcome;
    },
    getDivingTickCalls: () => divingTickCalls,
  };
}

const advanceTicks = (engine: GameEngine, n: number) => {
  for (let i = 0; i < n; i++) engine.advance(TICK_SECONDS);
};

describe("round state machine — §5 transition table on the simulation clock (D1)", () => {
  it("runs betting for exactly 300 ticks, then enters diving via the authority", () => {
    const h = makeHarness();
    expect(h.engine.state).toBe("betting");

    advanceTicks(h.engine, BETTING_TICKS - 1);
    expect(h.engine.state).toBe("betting");
    expect(h.engine.countdown).toBeCloseTo(TICK_SECONDS, 12);
    expect(h.getDivingTickCalls()).toBe(0); // pipeline never runs outside diving

    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("diving");
    expect(h.calls.crashPoint).toBe(1); // entry(diving) asked the authority once
    expect(h.engine.crashAt).toBe(2.5);
    expect(h.log.filter((e) => e.name === "diveStarted")).toEqual([
      { name: "diveStarted", payload: { roundId: 1 } },
    ]);

    advanceTicks(h.engine, 2); // pipeline runs once per tick while diving
    expect(h.getDivingTickCalls()).toBe(2);
    expect(h.engine.diveElapsed).toBeCloseTo(2 * TICK_SECONDS, 12);
  });

  it("crash path: terminal outcome → crashed (144 ticks) → betting; pipeline never re-fires (D3)", () => {
    const h = makeHarness();
    advanceTicks(h.engine, BETTING_TICKS); // → diving
    advanceTicks(h.engine, 10);

    h.setOutcome("crashed");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("crashed");
    expect(h.log.filter((e) => e.name === "crashed")).toEqual([
      { name: "crashed", payload: { roundId: 1, multiplier: 2.5 } },
    ]);

    const callsAtCrash = h.getDivingTickCalls();
    advanceTicks(h.engine, CRASH_BANNER_TICKS - 1);
    expect(h.engine.state).toBe("crashed");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("betting");
    expect(h.getDivingTickCalls()).toBe(callsAtCrash); // D3/structural: no pipeline outside diving
    expect(h.engine.countdown).toBe(5);
    expect(h.log.filter((e) => e.name === "roundEnded")).toEqual([
      { name: "roundEnded", payload: { roundId: 1, outcome: "crashed" } },
    ]);
    expect(h.log.filter((e) => e.name === "bettingOpened")).toEqual([
      { name: "bettingOpened", payload: { roundId: 2 } }, // next round's id
    ]);
  });

  it("jackpot path: seaFloor → impact (84 ticks) → bonus (waits forever) → pick → result (132 ticks) → betting", () => {
    const h = makeHarness();
    advanceTicks(h.engine, BETTING_TICKS); // → diving

    h.setOutcome("seaFloor");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("impact");
    expect(h.calls.jackpot).toBe(1);
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

    h.engine.pickChest(1);
    // Pre-D4 seam: applied + dispatched synchronously on the call.
    expect(h.log.filter((e) => e.name === "chestPicked")).toEqual([
      {
        name: "chestPicked",
        payload: { roundId: 1, chestId: 1, chestMultiplier: 6.5, finalMultiplier: 780 }, // +(120·6.5).toFixed(2)
      },
    ]);
    expect(h.engine.state).toBe("bonus"); // result interval still showing

    advanceTicks(h.engine, CHEST_RESULT_TICKS - 1);
    expect(h.engine.state).toBe("bonus");
    advanceTicks(h.engine, 1);
    expect(h.engine.state).toBe("betting");
    expect(h.log.filter((e) => e.name === "roundEnded")).toEqual([
      { name: "roundEnded", payload: { roundId: 1, outcome: "jackpot" } },
    ]);
  });

  it("rejects invalid pickChest commands and reports them (§5, §18) without state change", () => {
    const h = makeHarness();
    h.engine.pickChest(0); // still in betting
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

    // Reach bonus, pick once, then pick again.
    advanceTicks(h.engine, BETTING_TICKS);
    h.setOutcome("seaFloor");
    advanceTicks(h.engine, 1 + IMPACT_TICKS);
    expect(h.engine.state).toBe("bonus");
    h.engine.pickChest(0);
    h.engine.pickChest(2);
    const rejections = h.log.filter((e) => e.name === "commandRejected");
    expect(rejections).toHaveLength(2);
    expect(rejections[1].payload).toEqual({
      roundId: 1,
      command: { type: "pickChest", chestId: 2 },
      reason: "chest-already-picked",
    });
    expect(h.log.filter((e) => e.name === "chestPicked")).toHaveLength(1); // first pick stood
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
