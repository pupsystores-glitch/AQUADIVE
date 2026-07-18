// RoundStateMachine — the engine-owned round state machine
// (docs/06_ENGINE_ARCHITECTURE.md §5, §6; Sprint 3, Commit E4).
//
// Owns the five engine states, the round lifecycle timers, roundId, and
// the transition entry actions (which consult the RoundAuthority, §16).
// All timed transitions are simulation-time durations quantized to whole
// ticks (§8) and stored as integer tick counts — deterministic, no float
// drift. The component's setTimeout/setInterval chains are deleted in this
// same commit; their phase re-check guards are replaced structurally:
// exactly one pending timer exists, owned by the current state, so a stale
// timer can never fire in another state (§5's "cancelled on exit" rule
// falls out of the representation).
//
// Sanctioned deltas landing here (§7.1): D1 — phase timers and the
// multiplier's dive-elapsed time base (diveStartedAt) run on the
// simulation clock; D3 — the diving pipeline reports a terminal outcome
// and has already ended its tick when the machine transitions, so crash
// and sea-floor can never double-fire.
//
// Mid-migration seams (§20 risk 2, removed in E5): the diving pipeline
// body is still component-owned (injected `divingTick`, called only while
// `diving`); `crashAt` is exposed for that body's crash guard; pickChest
// applies immediately when called (D4 — tick-boundary commands — is E5).

import type { Phase } from "@/rendering/scene-renderer";
import { TICK_SECONDS } from "./clock";
import type { BonusChest } from "./domain/outcomes";
import {
  BETTING_WINDOW_SECONDS,
  CHEST_RESULT_TO_IDLE_MS,
  CRASH_BANNER_MS,
  SHIP_IMPACT_TO_CHESTS_MS,
} from "./domain/tuning";
import type { EngineEventMap, EngineStateName, EventBus } from "./events";
import type { RoundAuthority } from "./round-authority";

/** Terminal outcome of one diving tick (§6.3 steps 4/8): reported by the pipeline, applied by the machine. */
export type DivingTickOutcome = "crashed" | "seaFloor";

/** The fixed §5 projection: engine states → renderer Phase strings. The RenderState contract is untouched. */
export const ENGINE_STATE_TO_PHASE: Record<EngineStateName, Phase> = {
  betting: "idle",
  diving: "diving",
  crashed: "crashed",
  impact: "cashed",
  bonus: "bonus",
};

/** Duration (ms) → whole simulation ticks (§8 quantization). */
const ticksFor = (ms: number): number => Math.round(ms / 1000 / TICK_SECONDS);

interface RoundStateMachineDeps {
  authority: RoundAuthority;
  events: EventBus<EngineEventMap>;
  divingTick: (dtSeconds: number) => DivingTickOutcome | void;
}

export class RoundStateMachine {
  private _state: EngineStateName = "betting";
  private _roundId = 1;
  private countdownTicks = ticksFor(BETTING_WINDOW_SECONDS * 1000);
  /** Remaining ticks of the current state's single pending timer, if any. */
  private timerTicks: number | null = null;
  private _crashAt = 0;
  private _diveStartedAt = 0;
  private jackpotMultiplier = 0;
  private chests: [BonusChest, BonusChest, BonusChest] | null = null;
  private chosenChestId: 0 | 1 | 2 | null = null;

  constructor(private readonly deps: RoundStateMachineDeps) {}

  get state(): EngineStateName {
    return this._state;
  }

  get roundId(): number {
    return this._roundId;
  }

  /** Betting countdown remaining, in seconds (whole-tick quantized, §8). */
  get countdown(): number {
    return this.countdownTicks * TICK_SECONDS;
  }

  /** This round's crash point. Mid-migration read for the component diving body; internal from E5. */
  get crashAt(): number {
    return this._crashAt;
  }

  /** simTime at dive start — the D1 time base for the multiplier. Meaningful from the first dive on. */
  get diveStartedAt(): number {
    return this._diveStartedAt;
  }

  /** One simulation tick (§5 transition table). Called by GameEngine once per consumed tick. */
  step(simTime: number, dtSeconds: number): void {
    switch (this._state) {
      case "betting":
        this.countdownTicks--;
        if (this.countdownTicks <= 0) this.enterDiving(simTime);
        break;
      case "diving": {
        const outcome = this.deps.divingTick(dtSeconds);
        if (outcome === "crashed") this.enterCrashed();
        else if (outcome === "seaFloor") this.enterImpact();
        break;
      }
      case "crashed":
        if (this.timerTicks !== null && --this.timerTicks <= 0) this.enterBetting("crashed");
        break;
      case "impact":
        if (this.timerTicks !== null && --this.timerTicks <= 0) this.enterBonus();
        break;
      case "bonus":
        // No timer until a chest is picked: an unpicked chest waits forever
        // (§5, preserved as-is; the auto-pick timeout is reserved for Phase 8).
        if (this.timerTicks !== null && --this.timerTicks <= 0) this.enterBetting("jackpot");
        break;
    }
  }

  /**
   * Apply a chest pick (§5: bonus ──[pickChest]→ apply chest ──[CHEST_RESULT
   * duration]→ betting). Pre-D4 seam: applies immediately when called; E5
   * turns this into a queued command. Invalid picks are rejected and
   * reported (§5, §18 ring 1), never silently applied.
   */
  pickChest(chestId: 0 | 1 | 2): void {
    if (this._state !== "bonus" || this.chosenChestId !== null || this.chests === null) {
      this.deps.events.emit("commandRejected", {
        roundId: this._roundId,
        command: { type: "pickChest", chestId },
        reason: this._state !== "bonus" ? "not-in-bonus" : "chest-already-picked",
      });
      return;
    }
    this.chosenChestId = chestId;
    const chest = this.chests[chestId];
    const finalMultiplier = +(this.jackpotMultiplier * chest.multiplier).toFixed(2);
    this.deps.events.emit("chestPicked", {
      roundId: this._roundId,
      chestId,
      chestMultiplier: chest.multiplier,
      finalMultiplier,
    });
    this.timerTicks = ticksFor(CHEST_RESULT_TO_IDLE_MS);
  }

  private transition(to: EngineStateName): void {
    const from = this._state;
    this._state = to;
    this.deps.events.emit("stateChanged", { roundId: this._roundId, from, to });
  }

  // entry(diving), §5: the authority fixes crashAt; per-round outcome data
  // resets; diveStartedAt := simTime. World reset and participant-flag
  // reset stay component-owned until E5 — they ride the diveStarted event.
  private enterDiving(simTime: number): void {
    this._crashAt = this.deps.authority.sampleCrashPoint();
    this._diveStartedAt = simTime;
    this.jackpotMultiplier = 0;
    this.chests = null;
    this.chosenChestId = null;
    this.timerTicks = null;
    this.transition("diving");
    this.deps.events.emit("diveStarted", { roundId: this._roundId });
  }

  // entry(crashed), §5: the multiplier clamps to crashAt (the event carries
  // it); CRASH_BANNER duration → betting. Replaces the CRASH_BANNER_MS
  // setTimeout and its `phase === "crashed"` re-check guard.
  private enterCrashed(): void {
    this.timerTicks = ticksFor(CRASH_BANNER_MS);
    this.transition("crashed");
    this.deps.events.emit("crashed", { roundId: this._roundId, multiplier: this._crashAt });
  }

  // entry(impact), §5: the authority samples the jackpot; SHIP_IMPACT_TO_
  // CHESTS duration → bonus. Replaces that setTimeout and its phase
  // re-check guard; the old one-shot `bonusTriggered` flag is structural
  // now (diving has been exited).
  private enterImpact(): void {
    this.jackpotMultiplier = this.deps.authority.sampleJackpot();
    this.timerTicks = ticksFor(SHIP_IMPACT_TO_CHESTS_MS);
    this.transition("impact");
    this.deps.events.emit("shipImpact", {
      roundId: this._roundId,
      jackpotMultiplier: this.jackpotMultiplier,
    });
  }

  // entry(bonus), §5: the authority rolls the chests; then wait for the pick.
  private enterBonus(): void {
    this.chests = this.deps.authority.rollBonusChests();
    this.timerTicks = null;
    this.transition("bonus");
    this.deps.events.emit("chestsRevealed", { roundId: this._roundId, chests: this.chests });
  }

  // entry(betting), §5/§6: the round ends, the next roundId begins, the
  // countdown restarts. Replaces the countdown setInterval as the owner of
  // the betting→diving transition (the 100 ms interval that remains in the
  // component is display-only until delta D5 deletes it in E6).
  private enterBetting(outcome: "crashed" | "jackpot"): void {
    this.deps.events.emit("roundEnded", { roundId: this._roundId, outcome });
    this._roundId++;
    this.countdownTicks = ticksFor(BETTING_WINDOW_SECONDS * 1000);
    this.timerTicks = null;
    this.transition("betting");
    this.deps.events.emit("bettingOpened", { roundId: this._roundId });
  }
}
