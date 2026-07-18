// RoundAuthority — the only place outcome decisions are made
// (docs/06_ENGINE_ARCHITECTURE.md §16).
//
// The round state machine (E4) asks the authority at transition points; it
// never draws RNG itself. LocalRoundAuthority is today's client-authoritative
// behavior behind tomorrow's seam (the accepted TASK 001 flaw): Phase 8 adds
// a RemoteRoundAuthority that applies outcomes received from the server via
// RoundService, swapping this module without touching the engine core.

import {
  type BonusChest,
  rollBonusChests,
  sampleCrashPoint,
  sampleJackpot,
} from "./domain/outcomes";
import type { Rng } from "./rng";

export interface RoundAuthority {
  /** Multiplier at which this round's chain snaps — fixed at dive start (§5). */
  sampleCrashPoint(): number;
  /** Jackpot multiplier locked at ship impact (§5). */
  sampleJackpot(): number;
  /** The three bonus chests revealed after impact (§5). */
  rollBonusChests(): [BonusChest, BonusChest, BonusChest];
}

/** Authority mode: draws outcomes locally from the injected `outcome` stream (§11). */
export class LocalRoundAuthority implements RoundAuthority {
  constructor(private readonly outcome: Rng) {}

  sampleCrashPoint(): number {
    return sampleCrashPoint(this.outcome);
  }

  sampleJackpot(): number {
    return sampleJackpot(this.outcome);
  }

  rollBonusChests(): [BonusChest, BonusChest, BonusChest] {
    return rollBonusChests(this.outcome);
  }
}
