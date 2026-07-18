// RoundStateMachine — the engine-owned round state machine
// (docs/06_ENGINE_ARCHITECTURE.md §5, §6; Sprint 3, Commits E4–E5).
//
// Owns the five engine states, the round lifecycle timers, roundId, the
// participant round state (§2: bet placed this round, cashed-out flag and
// multiplier, chosen chest — never the wallet), and the transition entry
// actions (which consult the RoundAuthority, §16, and drive the
// DiveSimulation, §9). All timed transitions are simulation-time durations
// quantized to whole ticks (§8) and stored as integer tick counts —
// deterministic, no float drift. Exactly one pending timer exists, owned by
// the current state, so a stale timer can never fire in another state.
//
// Sanctioned deltas (§7.1): D1 (E4) — phase timers and the multiplier's
// dive-elapsed time base (diveStartedAt) run on the simulation clock; D3
// (E4) — the diving pipeline reports a terminal outcome and has already
// ended its tick when the machine transitions, so crash and sea-floor can
// never double-fire; D4 (E5) — commands are validated and applied here at
// the tick boundary (GameEngine drains its queue into applyCommand before
// stepping), so cashout uses the tick-authoritative multiplier, never a
// stale render's. Invalid commands are rejected and reported (§18 ring 1) —
// never silently applied, never thrown.
//
// E6: `impactAt` (simTime at entry(impact)) is recorded here so the engine
// computes `RenderState.shipImpact.elapsed = simTime − impactAt` on the
// simulation clock (§8 — the component's performance.now() bookkeeping is
// deleted); the machine's serializable slice is `RoundSnapshot` (§14).

import type { Phase } from "@/rendering/scene-renderer";
import { TICK_SECONDS } from "./clock";
import type { EngineCommand } from "./commands";
import type { BonusChest } from "./domain/outcomes";
import {
  BETTING_WINDOW_SECONDS,
  CHEST_RESULT_TO_IDLE_MS,
  CRASH_BANNER_MS,
  SHIP_IMPACT_TO_CHESTS_MS,
} from "./domain/tuning";
import type { EngineEventMap, EngineStateName, EventBus } from "./events";
import type { RoundAuthority } from "./round-authority";
import type { DiveSimulation } from "./simulation";

/** The fixed §5 projection: engine states → renderer Phase strings. The RenderState contract is untouched. */
export const ENGINE_STATE_TO_PHASE: Record<EngineStateName, Phase> = {
  betting: "idle",
  diving: "diving",
  crashed: "crashed",
  impact: "cashed",
  bonus: "bonus",
};

/** Participant round state (§2) — state about the player's *round*, never their wallet (§3). */
export interface ParticipantRoundState {
  betAmount: number;
  cashedOut: boolean;
  /** Multiplier locked at cashout (manual or jackpot auto-cash); null until then. */
  cashedOutAt: number | null;
}

/** Duration (ms) → whole simulation ticks (§8 quantization). */
const ticksFor = (ms: number): number => Math.round(ms / 1000 / TICK_SECONDS);

/**
 * The machine's serializable snapshot slice (§14): state-machine position,
 * round data (crashAt and unrevealed chests are authority-secret — the
 * public/authority split is latent until Phase 8), and participant round
 * state. Plain JSON data; arrays/objects are deep-copied on both
 * snapshot() and restore() so a snapshot never aliases live engine state.
 */
export interface RoundSnapshot {
  state: EngineStateName;
  roundId: number;
  countdownTicks: number;
  /** Remaining whole ticks of the current state's pending timer, if any. */
  timerTicks: number | null;
  diveStartedAt: number;
  crashAt: number;
  jackpotMultiplier: number;
  /** simTime at entry(impact); null outside the impact→next-dive window. */
  impactAt: number | null;
  chests: [BonusChest, BonusChest, BonusChest] | null;
  chosenChestId: 0 | 1 | 2 | null;
  participant: ParticipantRoundState | null;
}

interface RoundStateMachineDeps {
  authority: RoundAuthority;
  events: EventBus<EngineEventMap>;
  sim: DiveSimulation;
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
  private _impactAt: number | null = null;
  private _chests: [BonusChest, BonusChest, BonusChest] | null = null;
  private _chosenChestId: 0 | 1 | 2 | null = null;
  private _participant: ParticipantRoundState | null = null;

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

  /** This round's crash point — authority-secret (§14); never exposed on the facade. */
  get crashAt(): number {
    return this._crashAt;
  }

  /** simTime at dive start — the D1 time base for the multiplier. Meaningful from the first dive on. */
  get diveStartedAt(): number {
    return this._diveStartedAt;
  }

  get participant(): Readonly<ParticipantRoundState> | null {
    return this._participant;
  }

  /** simTime at entry(impact) — the §8 base for shipImpact FX elapsed; null outside impact→next-dive. */
  get impactAt(): number | null {
    return this._impactAt;
  }

  get chests(): Readonly<[BonusChest, BonusChest, BonusChest]> | null {
    return this._chests;
  }

  get chosenChestId(): 0 | 1 | 2 | null {
    return this._chosenChestId;
  }

  /** One simulation tick (§5 transition table). Called by GameEngine once per consumed tick. */
  step(simTime: number, dtSeconds: number): void {
    switch (this._state) {
      case "betting":
        this.countdownTicks--;
        if (this.countdownTicks <= 0) this.enterDiving(simTime);
        break;
      case "diving": {
        const outcome = this.deps.sim.tick(simTime - this._diveStartedAt, dtSeconds, this._crashAt);
        if (outcome === "crashed") this.enterCrashed();
        else if (outcome === "seaFloor") this.enterImpact(simTime);
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
   * Validate and apply one queued command against the *current* state
   * (§13: validated at the tick they apply, not at submit time; D4).
   * Called by GameEngine at the tick boundary, before step().
   */
  applyCommand(command: EngineCommand): void {
    switch (command.type) {
      case "placeBet":
        this.applyPlaceBet(command);
        break;
      case "cashOut":
        this.applyCashOut(command);
        break;
      case "pickChest":
        this.applyPickChest(command);
        break;
    }
  }

  private reject(command: EngineCommand, reason: string): void {
    this.deps.events.emit("commandRejected", { roundId: this._roundId, command, reason });
  }

  // §5/§6: one bet per participant per round, only while betting. Whether
  // the player can afford it is a wallet question answered before the
  // command is submitted (§3) — the engine never sees a balance.
  private applyPlaceBet(command: EngineCommand & { type: "placeBet" }): void {
    if (this._state !== "betting") return this.reject(command, "not-in-betting");
    if (this._participant !== null) return this.reject(command, "already-participating");
    if (!(command.amount > 0)) return this.reject(command, "invalid-amount");
    this._participant = { betAmount: command.amount, cashedOut: false, cashedOutAt: null };
    this.deps.events.emit("betPlaced", { roundId: this._roundId, amount: command.amount });
  }

  // §5: manual cashout is not a transition — the flag flips, the state stays
  // `diving`, the anchor keeps descending. D4: the multiplier is the
  // tick-authoritative value from the last completed pipeline tick.
  private applyCashOut(command: EngineCommand & { type: "cashOut" }): void {
    if (this._state !== "diving") return this.reject(command, "not-diving");
    if (this._participant === null) return this.reject(command, "not-participating");
    if (this._participant.cashedOut) return this.reject(command, "already-cashed-out");
    const multiplier = this.deps.sim.multiplier;
    this._participant.cashedOut = true;
    this._participant.cashedOutAt = multiplier;
    this.deps.events.emit("cashedOut", { roundId: this._roundId, multiplier });
  }

  // §5: bonus ──[pickChest]→ apply chest ──[CHEST_RESULT duration]→ betting.
  private applyPickChest(command: EngineCommand & { type: "pickChest" }): void {
    if (this._state !== "bonus" || this._chests === null) {
      return this.reject(command, "not-in-bonus");
    }
    if (this._chosenChestId !== null) return this.reject(command, "chest-already-picked");
    this._chosenChestId = command.chestId;
    const chest = this._chests[command.chestId];
    const finalMultiplier = +(this.jackpotMultiplier * chest.multiplier).toFixed(2);
    this.deps.sim.lockMultiplier(finalMultiplier);
    this.deps.events.emit("chestPicked", {
      roundId: this._roundId,
      chestId: command.chestId,
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

  // entry(diving), §5/§6.2: the authority fixes crashAt; the world resets
  // (worldY = 0, creatures cleared, spawn cursor reset, boost = 0,
  // multiplier = 1); per-round outcome data resets; diveStartedAt := simTime.
  // The participant (bet placed during betting) rides into the round.
  private enterDiving(simTime: number): void {
    this._crashAt = this.deps.authority.sampleCrashPoint();
    this._diveStartedAt = simTime;
    this.jackpotMultiplier = 0;
    this._impactAt = null;
    this._chests = null;
    this._chosenChestId = null;
    this.timerTicks = null;
    this.deps.sim.reset();
    this.transition("diving");
    this.deps.events.emit("diveStarted", { roundId: this._roundId });
  }

  // entry(crashed), §5: the multiplier clamps to crashAt (locked in the
  // simulation, carried by the event); CRASH_BANNER duration → betting.
  private enterCrashed(): void {
    this.deps.sim.lockMultiplier(this._crashAt);
    this.timerTicks = ticksFor(CRASH_BANNER_MS);
    this.transition("crashed");
    this.deps.events.emit("crashed", { roundId: this._roundId, multiplier: this._crashAt });
  }

  // entry(impact), §5/§6.5: the authority samples the jackpot; the jackpot
  // multiplier locks; a participant not yet cashed out is auto-cashed at it
  // (settlement credits on the shipImpact event, as today); impactAt := simTime
  // (the FX-elapsed base, §8); SHIP_IMPACT_TO_CHESTS duration → bonus.
  private enterImpact(simTime: number): void {
    this._impactAt = simTime;
    this.jackpotMultiplier = this.deps.authority.sampleJackpot();
    this.deps.sim.lockMultiplier(this.jackpotMultiplier);
    if (this._participant !== null && !this._participant.cashedOut) {
      this._participant.cashedOut = true;
      this._participant.cashedOutAt = this.jackpotMultiplier;
    }
    this.timerTicks = ticksFor(SHIP_IMPACT_TO_CHESTS_MS);
    this.transition("impact");
    this.deps.events.emit("shipImpact", {
      roundId: this._roundId,
      jackpotMultiplier: this.jackpotMultiplier,
    });
  }

  // entry(bonus), §5: the authority rolls the chests; then wait for the pick.
  private enterBonus(): void {
    this._chests = this.deps.authority.rollBonusChests();
    this.timerTicks = null;
    this.transition("bonus");
    this.deps.events.emit("chestsRevealed", { roundId: this._roundId, chests: this._chests });
  }

  // entry(betting), §5/§6: the round ends, the next roundId begins, the
  // countdown restarts, the participant round state clears. impactAt clears
  // too — the jackpot FX (1.4 s) is long over when the result interval ends.
  private enterBetting(outcome: "crashed" | "jackpot"): void {
    this.deps.events.emit("roundEnded", { roundId: this._roundId, outcome });
    this._roundId++;
    this.countdownTicks = ticksFor(BETTING_WINDOW_SECONDS * 1000);
    this.timerTicks = null;
    this._impactAt = null;
    this._participant = null;
    this.transition("betting");
    this.deps.events.emit("bettingOpened", { roundId: this._roundId });
  }

  /** The machine's §14 snapshot slice — plain data, deep-copied, no aliasing. */
  snapshot(): RoundSnapshot {
    return {
      state: this._state,
      roundId: this._roundId,
      countdownTicks: this.countdownTicks,
      timerTicks: this.timerTicks,
      diveStartedAt: this._diveStartedAt,
      crashAt: this._crashAt,
      jackpotMultiplier: this.jackpotMultiplier,
      impactAt: this._impactAt,
      chests:
        this._chests === null
          ? null
          : [{ ...this._chests[0] }, { ...this._chests[1] }, { ...this._chests[2] }],
      chosenChestId: this._chosenChestId,
      participant: this._participant === null ? null : { ...this._participant },
    };
  }

  /**
   * Set the machine to a snapshot's position (§14). A pure state
   * assignment: no entry actions run, no events are emitted — projections
   * of the restored state are correct by construction.
   */
  restore(s: RoundSnapshot): void {
    this._state = s.state;
    this._roundId = s.roundId;
    this.countdownTicks = s.countdownTicks;
    this.timerTicks = s.timerTicks;
    this._diveStartedAt = s.diveStartedAt;
    this._crashAt = s.crashAt;
    this.jackpotMultiplier = s.jackpotMultiplier;
    this._impactAt = s.impactAt;
    this._chests =
      s.chests === null ? null : [{ ...s.chests[0] }, { ...s.chests[1] }, { ...s.chests[2] }];
    this._chosenChestId = s.chosenChestId;
    this._participant = s.participant === null ? null : { ...s.participant };
  }
}
