// GameEngine — the engine facade (docs/06_ENGINE_ARCHITECTURE.md §13),
// landed as the E3 skeleton: the simulation clock + fixed-tick accumulator
// (§7, §8) and the event bus edge (§12). Sanctioned delta D2 lands here:
// simulation advances in fixed 60 Hz ticks instead of display-rate
// variable dt. The round state machine (E4), the simulation systems and
// command queue (E5), and the driver + projections (E6) migrate in behind
// this same advance() edge without changing it.
//
// Mid-migration seam (§20 risk 2): the per-tick simulation body still
// lives in the component and is injected as `deps.tick`, invoked once per
// fixed tick with dt = TICK_SECONDS. E5 deletes this seam when the systems
// move inside. The engine owns time from this commit on; the component's
// rAF loop only feeds wall-clock frame deltas into advance() (§21 E3:
// "driven from the existing component rAF" — the EngineDriver proper lands
// in E6). No wall clock is ever read inside this module (§8).

import { EventBus, type EngineEventMap } from "./events";

/** Fixed simulation tick length (§7: 60 Hz). */
export const TICK_SECONDS = 1 / 60;

/**
 * Catch-up cap per advance (§7): at most 3 ticks (= 0.05 s) are consumed
 * per call — the direct translation of the old per-frame
 * MAX_TICK_SECONDS = 0.05 clamp.
 */
export const MAX_TICKS_PER_ADVANCE = 3;

export interface GameEngineDeps {
  /**
   * TEMPORARY (E3→E5): the per-tick simulation body, still component-owned
   * mid-migration. Called once per consumed tick with dt = TICK_SECONDS.
   * Deleted in E5 when the simulation systems move into the engine.
   */
  tick: (dtSeconds: number) => void;
}

export class GameEngine {
  /** The broadcast edge (§12). Subscribe/unsubscribe only from outside; the engine emits. */
  readonly events = new EventBus<EngineEventMap>();

  private readonly deps: GameEngineDeps;
  private accumulator = 0;
  private ticks = 0;

  constructor(deps: GameEngineDeps) {
    this.deps = deps;
  }

  /** Total ticks stepped since construction. */
  get tickCount(): number {
    return this.ticks;
  }

  /** The simulation clock (§8): tick-derived, the only clock gameplay may read. */
  get simTime(): number {
    return this.ticks * TICK_SECONDS;
  }

  /**
   * Feed one wall-clock frame delta (seconds). The engine accumulates it
   * and consumes whole fixed ticks (§7):
   *   while (acc ≥ TICK_SECONDS && ticksThisAdvance < MAX_TICKS_PER_ADVANCE) step()
   * If the cap is hit, the remaining accumulated time is dropped — exactly
   * as the old per-frame clamp dropped it: after a tab switch the world
   * resumes, it does not fast-forward. Queued events are dispatched after
   * each completed tick (§12), never mid-pipeline.
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
      this.deps.tick(TICK_SECONDS);
      this.events.dispatchQueued();
    }
  }
}
