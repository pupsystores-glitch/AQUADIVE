// Characterization tests for the DiveSimulation pipeline (docs/06 §6.3,
// §9; Sprint 3, Commit E5). The pipeline body moved verbatim from the
// component; these tests pin its fixed step order — multiplier → boost
// decay + bonus → crash check (terminal, D3) → descent → spawner →
// collision → sea-floor check (terminal, D3) — against the pure domain
// math it composes. World draws use deterministic Rngs (§11): a constant
// 0.5 (seahorses at x = 0.5, never a goldfish) or a scripted prefix that
// forges a goldfish in the anchor's path.
import { describe, expect, it } from "vitest";
import { CHAIN_MAX_DEPTH } from "@/shared/world";
import { TICK_SECONDS } from "./clock";
import { descentSpeed } from "./domain/descent";
import { multiplierAt } from "./domain/multiplier";
import {
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  SPAWN_AHEAD_PX,
} from "./domain/tuning";
import type { Rng } from "./rng";
import { DiveSimulation, type DivingTickOutcome } from "./simulation";

const NEVER_CRASH = 1e9;
const constRng: Rng = { next: () => 0.5 };

/** Rng yielding the scripted prefix draws, then a constant fill value. */
const seqThen = (draws: number[], fill = 0.5): Rng => {
  let i = 0;
  return { next: () => (i < draws.length ? draws[i++] : fill) };
};

describe("DiveSimulation — the §6.3 diving pipeline", () => {
  it("integrates one tick: multiplier from dive-elapsed time, descent from descentSpeed(m)·dt", () => {
    const sim = new DiveSimulation(constRng);
    sim.reset();
    const outcome = sim.tick(TICK_SECONDS, TICK_SECONDS, NEVER_CRASH);
    expect(outcome).toBeUndefined();
    const m = multiplierAt(TICK_SECONDS);
    expect(sim.multiplier).toBe(m);
    expect(sim.worldY).toBe(descentSpeed(m) * TICK_SECONDS); // boost 0 → no speed factor
  });

  it("crash check is terminal (D3): nothing below it runs, multiplier keeps the last tick's value", () => {
    const sim = new DiveSimulation(constRng);
    sim.reset();
    expect(sim.tick(TICK_SECONDS, TICK_SECONDS, 1)).toBe("crashed"); // multiplierAt(1 tick) ≥ 1
    expect(sim.multiplier).toBe(1); // not overwritten by the crashing tick
    expect(sim.worldY).toBe(0); // descent never ran
    expect(sim.creatures).toHaveLength(0); // spawner never ran
  });

  it("spawns ahead of the anchor from the dive cursor: jittered interval, sequential ids", () => {
    const sim = new DiveSimulation(constRng);
    sim.reset(); // spawn cursor at DIVE_SPAWN_DEPTH_PX = 60
    sim.tick(TICK_SECONDS, TICK_SECONDS, NEVER_CRASH);

    // Constant 0.5 draws: interval 52 − 0.5·18 = 43 px; triggers at 60,
    // 103, … while trigger < worldY + SPAWN_AHEAD_PX; creature worldY =
    // trigger + 200 + 0.5·80 = trigger + 240.
    expect(sim.creatures.length).toBeGreaterThan(0);
    expect(sim.creatures[0]).toMatchObject({ id: 1, kind: "seahorse", x: 0.5, worldY: 300 });
    expect(sim.creatures[1]).toMatchObject({ id: 2, worldY: 343 });
    const triggers = sim.creatures.map((c) => c.worldY - 240);
    expect(Math.max(...triggers)).toBeLessThanOrEqual(sim.worldY + SPAWN_AHEAD_PX);
    expect(sim.creatures.map((c) => c.id)).toEqual(triggers.map((_, i) => i + 1));
  });

  it("uses the pre-dive spawn cursor (120 px) before the first reset", () => {
    const sim = new DiveSimulation(constRng);
    sim.tick(TICK_SECONDS, TICK_SECONDS, NEVER_CRASH); // no reset: INITIAL_SPAWN_DEPTH_PX
    expect(sim.creatures[0]).toMatchObject({ id: 1, worldY: 360 }); // 120 + 240
  });

  it("goldfish collision grants boost; boost then decays and bumps the multiplier", () => {
    // Scripted first creature: kind draw 0.97 → goldfish (surface band),
    // x = 0.1 + 0.5·0.8 = 0.5 (centre, inside COLLISION_DX_FRAC), worldY =
    // 60 + 200 + 0·80 = 260 → collides when worldY + 220 is within 28 px.
    const sim = new DiveSimulation(seqThen([0.97, 0.5, 0, 0.5, 0.5, 0.5]));
    sim.reset();

    let t = 0;
    let gainTick = 0;
    for (let i = 1; i <= 60 && sim.boost === 0; i++) {
      t += TICK_SECONDS;
      expect(sim.tick(t, TICK_SECONDS, NEVER_CRASH)).toBeUndefined();
      gainTick = i;
    }
    expect(sim.boost).toBe(BOOST_GAIN_PER_GOLDFISH); // 0 → min(1, 0 + 0.8)
    expect(gainTick).toBeLessThan(60);
    expect(sim.creatures[0].consumed).toBe(true);
    expect(sim.creatures[0].kind).toBe("goldfish");

    // Next tick: decay applies before the bonus is added to the multiplier.
    t += TICK_SECONDS;
    sim.tick(t, TICK_SECONDS, NEVER_CRASH);
    const decayed = BOOST_GAIN_PER_GOLDFISH - TICK_SECONDS * BOOST_DECAY_PER_SECOND;
    expect(sim.boost).toBeCloseTo(decayed, 12);
    expect(sim.multiplier).toBeCloseTo(multiplierAt(t) + decayed * BOOST_MULTIPLIER_BONUS, 12);
  });

  it("reaches the sea floor (terminal) and reports it once worldY ≥ CHAIN_MAX_DEPTH", () => {
    const sim = new DiveSimulation(constRng);
    sim.reset();
    let t = 0;
    let outcome: DivingTickOutcome | undefined;
    for (let i = 0; i < 5000 && outcome === undefined; i++) {
      t += TICK_SECONDS;
      const o = sim.tick(t, TICK_SECONDS, NEVER_CRASH);
      if (o) outcome = o;
    }
    expect(outcome).toBe("seaFloor");
    expect(sim.worldY).toBeGreaterThanOrEqual(CHAIN_MAX_DEPTH);
  });

  it("reset() clears the world but the creature id counter continues across rounds (§10)", () => {
    const sim = new DiveSimulation(constRng);
    sim.reset();
    sim.tick(TICK_SECONDS, TICK_SECONDS, NEVER_CRASH);
    const spawned = sim.creatures.length;
    expect(spawned).toBeGreaterThan(0);

    sim.reset();
    expect(sim.worldY).toBe(0);
    expect(sim.boost).toBe(0);
    expect(sim.multiplier).toBe(1);
    expect(sim.creatures).toHaveLength(0);

    sim.tick(TICK_SECONDS, TICK_SECONDS, NEVER_CRASH);
    expect(sim.creatures[0].id).toBe(spawned + 1); // ids never reused
    expect(sim.creatures[0].worldY).toBe(300); // cursor back to the dive start depth
  });

  it("lockMultiplier pins the round multiplier outside the pipeline (crash clamp, jackpot, chest final)", () => {
    const sim = new DiveSimulation(constRng);
    sim.lockMultiplier(120);
    expect(sim.multiplier).toBe(120);
  });
});
