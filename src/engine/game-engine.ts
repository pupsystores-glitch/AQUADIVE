// GameEngine — the engine facade (docs/06_ENGINE_ARCHITECTURE.md §13).
//
// E3 landed the simulation clock + fixed-tick accumulator (§7, §8;
// sanctioned delta D2) and the event bus edge (§12). E4 added the round
// state machine (§5, §6; deltas D1, D3). E5 moved the simulation systems
// inside (DiveSimulation, §9) and landed the command queue (§13; delta D4):
// submit() queues, and every queued command is validated and applied at the
// next tick boundary, before the machine steps — commands are part of the
// replayable input log (§7 determinism: state(n+1) = f(state(n),
// commandsAppliedAtTickBoundary, rngDraws)).
//
// E6 completes the extraction: the §14/§15 projections (getRenderState /
// getRenderTime / getPublicState) replace the mid-migration world getters,
// and snapshot()/restore() land (§14). The EngineDriver (driver.ts) owns
// the rAF loop and the wall clock; no wall clock is ever read inside the
// engine (§8) — advance() receives wall-clock deltas as inputs.

import { CHAIN_MAX_DEPTH } from "@/shared/world";
import type { Phase, RenderState, RenderTime } from "@/rendering/render-state";
import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import type { EngineCommand } from "./commands";
import type { BonusChest } from "./domain/outcomes";
import { MAX_TICK_SECONDS } from "./domain/tuning";
import { EventBus, type EngineEventMap, type EngineStateName } from "./events";
import type { RoundAuthority } from "./round-authority";
import type { Rng } from "./rng";
import { DiveSimulation, type WorldSnapshot } from "./simulation";
import {
  ENGINE_STATE_TO_PHASE,
  RoundStateMachine,
  type ParticipantRoundState,
  type RoundSnapshot,
} from "./state-machine";

export interface GameEngineDeps {
  /** Outcome authority consulted at transition entry actions (§16). */
  authority: RoundAuthority;
  /** The `world` Rng stream (§11): spawn intervals, creature kinds/attributes. */
  worldRng: Rng;
}

/**
 * The public UI state for the HUD (§13, §15): read by pull once per frame
 * (delta D5 — no per-tick events for continuous values). `phase` is the
 * fixed §5 projection onto renderer Phase strings — the vocabulary the
 * shell already speaks.
 */
export interface EnginePublicState {
  phase: Phase;
  roundId: number;
  countdownSeconds: number;
  multiplier: number;
  boost: number;
  participant: Readonly<ParticipantRoundState> | null;
  chests: Readonly<[BonusChest, BonusChest, BonusChest]> | null;
  chosenChestId: 0 | 1 | 2 | null;
}

/** Snapshot schema version — bump on any breaking change to the §14 shape. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * The complete, serializable engine state (§14): the unit of restore,
 * reconnect, spectator join, replay and testing. Plain JSON data only.
 * RNG stream positions are deliberately absent: in authority mode both
 * streams are unseeded Math.random (no position exists); seeded-stream
 * serialization lands with the Phase 8 seeded Rng. The AuthoritySnapshot/
 * PublicSnapshot secrecy split (§14 †) stays latent until Phase 8 — this
 * is the authority view.
 */
export interface EngineSnapshot {
  schemaVersion: number;
  tickCount: number;
  round: RoundSnapshot;
  world: WorldSnapshot;
}

export class GameEngine {
  /** The broadcast edge (§12). Subscribe/unsubscribe only from outside; the engine emits. */
  readonly events = new EventBus<EngineEventMap>();

  private readonly sim: DiveSimulation;
  private readonly machine: RoundStateMachine;
  private commandQueue: EngineCommand[] = [];
  private accumulator = 0;
  private ticks = 0;
  /** Last advance()'s clamped wall dt — the renderer contract value (docs/05 §4), never a simulation input. */
  private lastFrameDt = 0;

  constructor(deps: GameEngineDeps) {
    this.sim = new DiveSimulation(deps.worldRng);
    this.machine = new RoundStateMachine({
      authority: deps.authority,
      events: this.events,
      sim: this.sim,
    });
  }

  /** Total ticks stepped since construction. */
  get tickCount(): number {
    return this.ticks;
  }

  /** The simulation clock (§8): tick-derived, the only clock gameplay may read. */
  get simTime(): number {
    return this.ticks * TICK_SECONDS;
  }

  /** Current engine state (§5 names; projected to renderer Phase in getRenderState/getPublicState). */
  get state(): EngineStateName {
    return this.machine.state;
  }

  /**
   * The renderer's per-frame input (§15): byte-compatible with the docs/05
   * §4 shape. shipImpact.elapsed is simulation-clock based (§8: simTime −
   * impactAt); the FX *lifetime* cutoff is renderer-owned (docs/05 R5 —
   * the Effects layer no-ops once elapsed exceeds it), so the field stays
   * non-null from impact until the next round's world reset.
   */
  getRenderState(): RenderState {
    const state = this.machine.state;
    const worldY = this.sim.worldY;
    const impactAt = this.machine.impactAt;
    return {
      phase: ENGINE_STATE_TO_PHASE[state],
      worldY,
      depthRatio: Math.min(1, worldY / CHAIN_MAX_DEPTH),
      boost: this.sim.boost,
      creatures: this.sim.creatures,
      crashed: state === "crashed",
      shipImpact: impactAt === null ? null : { elapsed: this.simTime - impactAt },
    };
  }

  /**
   * The renderer's clock (§8, §13): animTime is the simulation clock;
   * frameDt is the last advance()'s clamped wall delta — a presentation
   * value the driver fed in, never read from a clock here.
   */
  getRenderTime(): RenderTime {
    return { animTime: this.simTime, frameDt: this.lastFrameDt };
  }

  /** The HUD's per-frame state read (§13; delta D5 — pull, not events). */
  getPublicState(): EnginePublicState {
    return {
      phase: ENGINE_STATE_TO_PHASE[this.machine.state],
      roundId: this.machine.roundId,
      countdownSeconds: this.machine.countdown,
      multiplier: this.sim.multiplier,
      boost: this.sim.boost,
      participant: this.machine.participant,
      chests: this.machine.chests,
      chosenChestId: this.machine.chosenChestId,
    };
  }

  /** The complete serializable engine state (§14). Built on demand, never per tick. */
  snapshot(): EngineSnapshot {
    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      tickCount: this.ticks,
      round: this.machine.snapshot(),
      world: this.sim.snapshot(),
    };
  }

  /**
   * Set the engine to a snapshot's state (§14): the reconnect / spectator-
   * join / replay entry point. Pending commands and accumulated wall time
   * are discarded (they belong to the abandoned timeline); no events are
   * emitted — the §14 invariant makes the first projected frame correct by
   * construction. An unknown schema is rejected (§18 ring 1): engineError
   * is reported and the current state is left untouched.
   */
  restore(snapshot: EngineSnapshot): void {
    if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      this.events.emit("engineError", {
        roundId: this.machine.roundId,
        code: "snapshot-schema-mismatch",
        detail: { schemaVersion: snapshot.schemaVersion },
      });
      return;
    }
    this.ticks = snapshot.tickCount;
    this.accumulator = 0;
    this.commandQueue = [];
    this.machine.restore(snapshot.round);
    this.sim.restore(snapshot.world);
  }

  /**
   * Queue a command (§13). Validated against the state at the tick it
   * applies — the next tick boundary (D4) — never at submit time.
   * Rejections emit `commandRejected`; commands never throw.
   */
  submit(command: EngineCommand): void {
    this.commandQueue.push(command);
  }

  /**
   * Feed one wall-clock frame delta (seconds). The engine accumulates it
   * and consumes whole fixed ticks (§7):
   *   while (acc ≥ TICK_SECONDS && ticksThisAdvance < MAX_TICKS_PER_ADVANCE) step()
   * If the cap is hit, the remaining accumulated time is dropped — exactly
   * as the old per-frame clamp dropped it: after a tab switch the world
   * resumes, it does not fast-forward. Each consumed tick applies the
   * queued commands (D4), steps the round state machine, then dispatches
   * queued events (§12) — never mid-pipeline. Commands submitted by event
   * listeners land in the next tick's batch (§12: no reentrancy).
   */
  advance(wallDtSeconds: number): void {
    this.lastFrameDt = Math.min(MAX_TICK_SECONDS, wallDtSeconds);
    this.accumulator += wallDtSeconds;
    let ticksThisAdvance = 0;
    while (this.accumulator >= TICK_SECONDS) {
      if (ticksThisAdvance >= MAX_TICKS_PER_ADVANCE) {
        this.accumulator = 0;
        break;
      }
      this.accumulator -= TICK_SECONDS;
      this.ticks++;
      ticksThisAdvance++;
      this.drainCommands();
      this.machine.step(this.simTime, TICK_SECONDS);
      this.events.dispatchQueued();
    }
  }

  // Apply the commands queued before this tick, in submit order (D4).
  // Snapshotting the batch first means commands submitted while applying
  // (or during event dispatch) wait for the next tick boundary.
  private drainCommands(): void {
    if (this.commandQueue.length === 0) return;
    const batch = this.commandQueue;
    this.commandQueue = [];
    for (const command of batch) this.machine.applyCommand(command);
  }
}
