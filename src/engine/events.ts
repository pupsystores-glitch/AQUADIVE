// Typed engine event bus — the engine's broadcast edge (docs/06_ENGINE_ARCHITECTURE.md §12).
//
// E3 lands the mechanism and finalizes the event map shapes; emitters land
// with their owners (round state machine → E4, systems + command queue →
// E5). Rules implemented here, per §12/§18:
// - Edge-triggered only: nothing fires per tick; continuous values are
//   state, read by pull.
// - emit() queues; GameEngine drains the queue after each completed tick
//   (dispatchQueued), so listeners always observe consistent post-tick
//   state, never a mid-pipeline one.
// - Events emitted while dispatching are deferred to the next dispatch —
//   no reentrancy by construction.
// - Listener exceptions are firewalled: caught and logged, remaining
//   listeners still run. A broken FX hook must never kill settlement.

import type { EngineCommand } from "./commands";
import type { BonusChest } from "./domain/outcomes";

/** Engine state names (§5) — the state machine itself lands in E4. */
export type EngineStateName = "betting" | "diving" | "crashed" | "impact" | "bonus";

/** The §12 event map. Every payload carries the roundId it belongs to (§6). */
export interface EngineEventMap {
  bettingOpened: { roundId: number };
  betPlaced: { roundId: number; amount: number };
  commandRejected: { roundId: number; command: EngineCommand; reason: string };
  diveStarted: { roundId: number };
  cashedOut: { roundId: number; multiplier: number };
  crashed: { roundId: number; multiplier: number };
  shipImpact: { roundId: number; jackpotMultiplier: number };
  chestsRevealed: { roundId: number; chests: [BonusChest, BonusChest, BonusChest] };
  chestPicked: {
    roundId: number;
    chestId: 0 | 1 | 2;
    chestMultiplier: number;
    finalMultiplier: number;
  };
  roundEnded: { roundId: number; outcome: "crashed" | "jackpot" };
  stateChanged: { roundId: number; from: EngineStateName; to: EngineStateName };
  engineError: { roundId: number; code: string; detail?: unknown };
}

type QueuedEvent<M> = { [K in keyof M]: { name: K; payload: M[K] } }[keyof M];

export class EventBus<M> {
  private listeners: { [K in keyof M]?: Set<(payload: M[K]) => void> } = {};
  private queue: QueuedEvent<M>[] = [];

  /** Subscribe; returns the matching unsubscribe function. */
  on<K extends keyof M>(name: K, listener: (payload: M[K]) => void): () => void {
    (this.listeners[name] ??= new Set()).add(listener);
    return () => this.off(name, listener);
  }

  off<K extends keyof M>(name: K, listener: (payload: M[K]) => void): void {
    this.listeners[name]?.delete(listener);
  }

  /** Engine-internal: queue an event for post-tick dispatch (§12). Fire-and-forget. */
  emit<K extends keyof M>(name: K, payload: M[K]): void {
    this.queue.push({ name, payload } as QueuedEvent<M>);
  }

  /**
   * Engine-internal: deliver everything queued so far, in emit order.
   * Called by GameEngine after each completed tick (§12). Listener
   * exceptions are caught and logged so remaining listeners run (§18);
   * events emitted during dispatch stay queued for the next dispatch.
   */
  dispatchQueued(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    for (const event of batch) {
      const set = this.listeners[event.name];
      if (!set) continue;
      for (const listener of [...set]) {
        try {
          (listener as (payload: M[keyof M]) => void)(event.payload);
        } catch (error) {
          console.error("[engine] event listener failed:", String(event.name), error);
        }
      }
    }
  }
}
