// DiveSimulation — the engine-owned world simulation
// (docs/06_ENGINE_ARCHITECTURE.md §9, §10; Sprint 3, Commit E5).
//
// Owns the world state (worldY, boost, multiplier, the flat creature array
// and its spawn cursor, §10) and the diving tick pipeline (§6.3 steps 2–8),
// moved verbatim from the stepSimulation closure in AbyssAnchor.tsx. The
// pipeline order is fixed and preserved: multiplier → boost decay + bonus →
// crash check (terminal, D3) → descent → spawner → collision → sea-floor
// check (terminal, D3). A terminal outcome ends the pipeline for the tick;
// the state machine applies the transition and its entry actions.
//
// World draws (spawn jitter, creature rolls) come from the injected `world`
// Rng stream (§11) — outcome-relevant, never cosmetic. The state machine is
// the only caller of tick() (while diving) and reset() (entry(diving)).

import { ANCHOR_WORLD_OFFSET_PX, CHAIN_MAX_DEPTH } from "@/shared/world";
import { rollCreature, type Creature } from "./domain/creatures";
import { descentSpeed } from "./domain/descent";
import { multiplierAt } from "./domain/multiplier";
import {
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  BOOST_SPEED_FACTOR,
  COLLISION_DX_FRAC,
  COLLISION_DY_PX,
  CREATURE_SPAWN_EVERY,
  DIVE_SPAWN_DEPTH_PX,
  INITIAL_SPAWN_DEPTH_PX,
  SPAWN_AHEAD_PX,
  SPAWN_JITTER_PX,
} from "./domain/tuning";
import type { Rng } from "./rng";

/** Terminal outcome of one diving tick (§6.3 steps 4/8): reported by the pipeline, applied by the machine. */
export type DivingTickOutcome = "crashed" | "seaFloor";

/**
 * The world's serializable snapshot slice (§14): anchor depth, boost,
 * multiplier, the creature collection and its spawn cursor. Plain JSON
 * data; the creature array is deep-copied on both snapshot() and restore()
 * so a snapshot never aliases live engine state.
 */
export interface WorldSnapshot {
  worldY: number;
  boost: number;
  multiplier: number;
  nextSpawnAt: number;
  nextCreatureId: number;
  creatures: Creature[];
}

export class DiveSimulation {
  private _worldY = 0; // anchor's depth in world px
  private _boost = 0; // 0..1 short boost when goldfish
  private _multiplier = 1;
  private _creatures: Creature[] = [];
  private nextSpawnAt = INITIAL_SPAWN_DEPTH_PX;
  private nextCreatureId = 1;

  constructor(private readonly worldRng: Rng) {}

  get worldY(): number {
    return this._worldY;
  }

  get boost(): number {
    return this._boost;
  }

  /** Last tick's multiplier (incl. boost bonus) — the D4 tick-authoritative cashout value. */
  get multiplier(): number {
    return this._multiplier;
  }

  get creatures(): readonly Creature[] {
    return this._creatures;
  }

  /** entry(diving) world reset (§6.2). The creature id counter deliberately continues across rounds. */
  reset(): void {
    this._worldY = 0;
    this._creatures = [];
    this.nextSpawnAt = DIVE_SPAWN_DEPTH_PX;
    this._boost = 0;
    this._multiplier = 1;
  }

  /**
   * Lock the round multiplier at a transition entry: the crash clamp
   * (entry(crashed)), the jackpot (entry(impact)), the chest final. Keeps
   * engine state coherent with the §5 outcomes outside the diving pipeline.
   */
  lockMultiplier(value: number): void {
    this._multiplier = value;
  }

  /** The world's §14 snapshot slice — plain data, deep-copied, no aliasing. */
  snapshot(): WorldSnapshot {
    return {
      worldY: this._worldY,
      boost: this._boost,
      multiplier: this._multiplier,
      nextSpawnAt: this.nextSpawnAt,
      nextCreatureId: this.nextCreatureId,
      creatures: this._creatures.map((c) => ({ ...c })),
    };
  }

  /** Set the world to a snapshot's state (§14). Pure assignment; no draws, no events. */
  restore(s: WorldSnapshot): void {
    this._worldY = s.worldY;
    this._boost = s.boost;
    this._multiplier = s.multiplier;
    this.nextSpawnAt = s.nextSpawnAt;
    this.nextCreatureId = s.nextCreatureId;
    this._creatures = s.creatures.map((c) => ({ ...c }));
  }

  /**
   * One diving tick (§6.3 steps 2–8), dt = TICK_SECONDS. `diveElapsed` is
   * dive-elapsed simulation time — the multiplier's D1 time base. Returns a
   * terminal outcome (D3: the caller transitions; nothing below the
   * terminal step ran) or nothing.
   */
  tick(diveElapsedSeconds: number, dtSeconds: number, crashAt: number): DivingTickOutcome | void {
    let m = multiplierAt(diveElapsedSeconds);
    // boost decays
    if (this._boost > 0) {
      this._boost = Math.max(0, this._boost - dtSeconds * BOOST_DECAY_PER_SECOND);
      m += this._boost * BOOST_MULTIPLIER_BONUS; // small bump while active
    }

    // crash check — terminal (D3); entry(crashed) clamps the multiplier
    if (m >= crashAt) return "crashed";
    this._multiplier = m;

    // descent
    const speed = descentSpeed(m) * (1 + this._boost * BOOST_SPEED_FACTOR);
    this._worldY += speed * dtSeconds;

    // spawn creatures (world-stream draws, §11)
    while (this._worldY + SPAWN_AHEAD_PX > this.nextSpawnAt) {
      this._creatures.push(rollCreature(this.nextSpawnAt, this.nextCreatureId++, this.worldRng));
      this.nextSpawnAt += CREATURE_SPAWN_EVERY - this.worldRng.next() * SPAWN_JITTER_PX;
    }

    // collision with goldfish → boost
    const anchorWorldY = this._worldY + ANCHOR_WORLD_OFFSET_PX;
    for (const c of this._creatures) {
      if (c.consumed) continue;
      const dy = Math.abs(c.worldY - anchorWorldY);
      if (dy < COLLISION_DY_PX && Math.abs(c.x - 0.5) < COLLISION_DX_FRAC) {
        if (c.kind === "goldfish") {
          c.consumed = true;
          this._boost = Math.min(1, this._boost + BOOST_GAIN_PER_GOLDFISH);
        }
      }
    }

    // sea floor → SHIP IMPACT — terminal (D3); entry(impact) samples the jackpot
    if (this._worldY >= CHAIN_MAX_DEPTH) return "seaFloor";
  }
}
