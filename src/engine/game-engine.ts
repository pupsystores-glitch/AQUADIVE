// GameEngine — the engine facade (docs/06_ENGINE_ARCHITECTURE.md §13).
//
// E3 landed the simulation clock + fixed-tick accumulator (§7, §8;
// sanctioned delta D2) and the event bus edge (§12). E4 adds the round
// state machine (§5, §6): the machine steps once per consumed tick, owns
// all phase transitions and lifecycle timers on the simulation clock
// (deltas D1, D3), and consults the injected RoundAuthority at transition
// entries (§16).
//
// Mid-migration seams (§20 risk 2): the diving pipeline body is still
// component-owned, injected as `deps.divingTick` and called by the machine
// only while `diving` (deleted in E5 when the simulation systems move
// inside); `crashAt`/`diveElapsed` are exposed for that body; pickChest
// applies immediately (D4 — the command queue — lands in E5). The
// component's rAF loop feeds wall-clock frame deltas into advance() until
// the EngineDriver lands (E6). No wall clock is ever read inside the
// engine (§8).

import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import { EventBus, type EngineEventMap, type EngineStateName } from "./events";
import type { RoundAuthority } from "./round-authority";
import { RoundStateMachine, type DivingTickOutcome } from "./state-machine";

export interface GameEngineDeps {
  /** Outcome authority consulted at transition entry actions (§16). */
  authority: RoundAuthority;
  /**
   * TEMPORARY (E4→E5): the diving-tick pipeline body, still
   * component-owned. Called once per consumed tick while the machine is in
   * `diving` with dt = TICK_SECONDS; returns a terminal outcome (D3) or
   * nothing. Deleted in E5 when the simulation systems move inside.
   */
  divingTick: (dtSeconds: number) => DivingTickOutcome | void;
}

export class GameEngine {
  /** The broadcast edge (§12). Subscribe/unsubscribe only from outside; the engine emits. */
  readonly events = new EventBus<EngineEventMap>();

  private readonly machine: RoundStateMachine;
  private accumulator = 0;
  private ticks = 0;

  constructor(deps: GameEngineDeps) {
    this.machine = new RoundStateMachine({
      authority: deps.authority,
      events: this.events,
      divingTick: deps.divingTick,
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

  /** Dive-elapsed simulation time (D1): the multiplier's time base. Meaningful while diving. */
  get diveElapsed(): number {
    return this.simTime - this.machine.diveStartedAt;
  }

  /** This round's crash point — mid-migration read for the component diving body (internal from E5). */
  get crashAt(): number {
    return this.machine.crashAt;
  }

  /**
   * Apply a chest pick. Pre-D4 seam (E5 replaces this with a queued
   * `pickChest` command): applies immediately and dispatches the resulting
   * events synchronously so the UI keeps today's same-click feedback.
   */
  pickChest(chestId: 0 | 1 | 2): void {
    this.machine.pickChest(chestId);
    this.events.dispatchQueued();
  }

  /**
   * Feed one wall-clock frame delta (seconds). The engine accumulates it
   * and consumes whole fixed ticks (§7):
   *   while (acc ≥ TICK_SECONDS && ticksThisAdvance < MAX_TICKS_PER_ADVANCE) step()
   * If the cap is hit, the remaining accumulated time is dropped — exactly
   * as the old per-frame clamp dropped it: after a tab switch the world
   * resumes, it does not fast-forward. Each consumed tick steps the round
   * state machine; queued events are dispatched after each completed tick
   * (§12), never mid-pipeline.
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
      this.machine.step(this.simTime, TICK_SECONDS);
      this.events.dispatchQueued();
    }
  }
}
