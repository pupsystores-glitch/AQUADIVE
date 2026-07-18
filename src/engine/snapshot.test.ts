// snapshot()/restore() tests (Sprint 3, Commit E6; docs/06 §14): the §14
// invariants — plain serializable data, no aliasing of live state,
// projections correct from the first restored frame, and determinism
// restated on snapshots: restore(s) + identical commands + identical RNG ⇒
// identical subsequent snapshots. The world Rng here is a constant stream,
// so stream *position* is irrelevant (§14's RNG-position field only exists
// in seeded mode, which lands with Phase 8).
import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "./clock";
import { GameEngine, SNAPSHOT_SCHEMA_VERSION } from "./game-engine";
import type { RoundAuthority } from "./round-authority";

const stubAuthority = (crashPoint: number): RoundAuthority => ({
  sampleCrashPoint: () => crashPoint,
  sampleJackpot: () => 120,
  rollBonusChests: () => [
    { id: 0, multiplier: 2, opened: false },
    { id: 1, multiplier: 6.5, opened: false },
    { id: 2, multiplier: 30, opened: false },
  ],
});

const makeEngine = (crashPoint = 1e9) =>
  new GameEngine({ authority: stubAuthority(crashPoint), worldRng: { next: () => 0.5 } });

const BETTING_TICKS = 300;

const advanceTicks = (engine: GameEngine, n: number) => {
  for (let i = 0; i < n; i++) engine.advance(TICK_SECONDS);
};

describe("EngineSnapshot — §14 model", () => {
  it("round-trips: restore(snapshot()) reproduces the state, the projections and the re-snapshot", () => {
    const a = makeEngine();
    a.submit({ type: "placeBet", amount: 25 });
    advanceTicks(a, BETTING_TICKS + 100); // mid-dive, participant riding

    const s = a.snapshot();
    const b = makeEngine();
    b.restore(s);

    expect(b.tickCount).toBe(a.tickCount);
    expect(b.state).toBe("diving");
    expect(b.snapshot()).toEqual(s);
    // §14: projections are pure functions of (snapshot, simTime) — the
    // first restored frame is correct by construction.
    expect(b.getRenderState()).toEqual(a.getRenderState());
    expect(b.getPublicState()).toEqual(a.getPublicState());
  });

  it("is plain JSON-serializable data: a JSON round-trip is lossless", () => {
    const a = makeEngine();
    a.submit({ type: "placeBet", amount: 10 });
    advanceTicks(a, BETTING_TICKS + 200);
    const s = a.snapshot();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("never aliases live engine state: snapshot and restore both deep-copy", () => {
    const a = makeEngine();
    advanceTicks(a, BETTING_TICKS + 200); // creatures exist
    const s = a.snapshot();
    expect(s.world.creatures.length).toBeGreaterThan(0);

    // Mutating the snapshot must not reach the engine that produced it…
    const originalX = a.getRenderState().creatures[0].x;
    s.world.creatures[0].x = -1;
    expect(a.getRenderState().creatures[0].x).toBe(originalX);

    // …nor an engine that restored from it.
    const b = makeEngine();
    b.restore(s);
    s.world.creatures[0].x = -2;
    s.world.worldY = 0;
    expect(b.getRenderState().creatures[0].x).toBe(-1); // value at restore time
    expect(b.getRenderState().worldY).toBe(a.getRenderState().worldY);
  });

  it("continues the identical timeline: restore + identical commands + identical RNG (§14 determinism)", () => {
    const a = makeEngine();
    a.submit({ type: "placeBet", amount: 10 });
    advanceTicks(a, BETTING_TICKS + 50);

    const b = makeEngine();
    b.restore(a.snapshot());

    // Identical subsequent inputs on both engines: cash out, ride to the
    // sea floor, through impact and bonus, pick a chest, next round opens.
    a.submit({ type: "cashOut" });
    b.submit({ type: "cashOut" });
    for (let i = 0; i < 5000 && a.state === "diving"; i++) {
      a.advance(TICK_SECONDS);
      b.advance(TICK_SECONDS);
    }
    expect(a.state).toBe("impact");
    expect(b.snapshot()).toEqual(a.snapshot());

    advanceTicks(a, 84);
    advanceTicks(b, 84);
    expect(a.state).toBe("bonus");
    a.submit({ type: "pickChest", chestId: 1 });
    b.submit({ type: "pickChest", chestId: 1 });
    advanceTicks(a, 1 + 132);
    advanceTicks(b, 1 + 132);
    expect(a.state).toBe("betting");
    expect(b.snapshot()).toEqual(a.snapshot());
  });

  it("discards pending commands and accumulated wall time on restore", () => {
    const a = makeEngine();
    a.submit({ type: "placeBet", amount: 10 });
    advanceTicks(a, BETTING_TICKS + 10); // diving, participant riding
    const s = a.snapshot();

    const cashouts: unknown[] = [];
    a.events.on("cashedOut", (p) => cashouts.push(p));
    a.submit({ type: "cashOut" }); // queued on the abandoned timeline
    a.advance(0.9 * TICK_SECONDS); // sub-tick wall time accumulated
    a.restore(s);

    // Had the 0.9-tick remainder survived the restore, this half-tick
    // advance would cross a boundary and consume a phantom tick.
    a.advance(0.5 * TICK_SECONDS);
    expect(a.tickCount).toBe(s.tickCount);

    advanceTicks(a, 5);
    expect(cashouts).toEqual([]); // the queued command died with the timeline
    expect(a.getPublicState().participant?.cashedOut).toBe(false);
  });

  it("rejects an unknown schema version: engineError reported, state untouched (§18 ring 1)", () => {
    const a = makeEngine();
    advanceTicks(a, 10);
    const before = a.snapshot();
    const errors: unknown[] = [];
    a.events.on("engineError", (p) => errors.push(p));

    a.restore({ ...before, schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 });
    expect(a.snapshot()).toEqual(before);

    advanceTicks(a, 1); // engineError rides the post-tick dispatch (§12)
    expect(errors).toEqual([
      {
        roundId: 1,
        code: "snapshot-schema-mismatch",
        detail: { schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 },
      },
    ]);
  });
});
