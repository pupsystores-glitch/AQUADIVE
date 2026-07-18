// GameEngine — the engine facade (docs/06_ENGINE_ARCHITECTURE.md §13).
//
// E3 landed the simulation clock + fixed-tick accumulator (§7, §8;
// sanctioned delta D2) and the event bus edge (§12). E4 added the round
// state machine (§5, §6; deltas D1, D3). E5 moves the simulation systems
// inside (DiveSimulation, §9 — the divingTick seam is gone) and lands the
// command queue (§13; delta D4): submit() queues, and every queued command
// is validated and applied at the next tick boundary, before the machine
// steps — commands are part of the replayable input log (§7 determinism:
// state(n+1) = f(state(n), commandsAppliedAtTickBoundary, rngDraws)).
//
// Remaining mid-migration seams (§20 risk 2, removed in E6): the component
// rAF feeds wall-clock frame deltas into advance() until the EngineDriver
// lands; the world/HUD reads below (worldY, boost, multiplier, creatures)
// are plain getters until the §14/§15 projections (getRenderState /
// getPublicState) land. No wall clock is ever read inside the engine (§8).

import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import type { EngineCommand } from "./commands";
import type { Creature } from "./domain/creatures";
import { EventBus, type EngineEventMap, type EngineStateName } from "./events";
import type { RoundAuthority } from "./round-authority";
import type { Rng } from "./rng";
import { DiveSimulation } from "./simulation";
import { RoundStateMachine } from "./state-machine";

export interface GameEngineDeps {
  /** Outcome authority consulted at transition entry actions (§16). */
  authority: RoundAuthority;
  /** The `world` Rng stream (§11): spawn intervals, creature kinds/attributes. */
  worldRng: Rng;
}

export class GameEngine {
  /** The broadcast edge (§12). Subscribe/unsubscribe only from outside; the engine emits. */
  readonly events = new EventBus<EngineEventMap>();

  private readonly sim: DiveSimulation;
  private readonly machine: RoundStateMachine;
  private commandQueue: EngineCommand[] = [];
  private accumulator = 0;
  private ticks = 0;

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

  /** Current engine state (§5 names; project to renderer Phase via ENGINE_STATE_TO_PHASE). */
  get state(): EngineStateName {
    return this.machine.state;
  }

  /** Betting countdown remaining, seconds (whole-tick quantized, §8). */
  get countdown(): number {
    return this.machine.countdown;
  }

  /** Anchor depth in world px — simulation state, read by pull (§12). */
  get worldY(): number {
    return this.sim.worldY;
  }

  /** Golden boost, 0..1 — simulation state, read by pull (§12). */
  get boost(): number {
    return this.sim.boost;
  }

  /** The round multiplier (grows while diving; locked at crash/jackpot/chest). */
  get multiplier(): number {
    return this.sim.multiplier;
  }

  /** The engine-owned creature collection (§10), projected read-only. */
  get creatures(): readonly Creature[] {
    return this.sim.creatures;
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
