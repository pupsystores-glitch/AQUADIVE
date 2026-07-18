// EngineDriver — the engine's edge to the host environment
// (docs/06_ENGINE_ARCHITECTURE.md §13; Sprint 3, Commit E6).
//
// The driver owns the two host dependencies the engine core must never
// touch (§8): the rAF loop and the wall clock (rAF timestamps). Per frame
// it feeds the wall-clock delta into engine.advance(), then hands the
// engine's projections to the attached sink: the RenderState/RenderTime
// frame (→ SceneRenderer) and the per-frame public-state sync (→ the UI
// store; sanctioned delta D5 — the HUD reads engine state each frame, no
// display intervals). Ticks and frames stay independent (§7): the engine
// consumes fixed 60 Hz ticks from the accumulator while the sink renders
// once per rAF at whatever rate the display runs.
//
// This is the single sanctioned requestAnimationFrame site in src/engine
// (§4). No DOM beyond that: canvas sizing and store updates live in the
// sink, implemented by the host (the React shell). The driver+engine pair
// is owned per game session, not per component mount (§13) — detach stops
// the loop but keeps all engine state, so remounting the component resumes
// the world instead of restarting it.

import type { RenderState, RenderTime } from "@/rendering/render-state";
import type { EnginePublicState, GameEngine } from "./game-engine";

/** What the host attaches to the driver: the per-frame consumers of the engine's projections. */
export interface EngineDriverSink {
  /** Render the frame (→ SceneRenderer.frame, after any host-side resize). */
  frame(state: RenderState, time: RenderTime): void;
  /** Optional per-frame HUD/store sync (§13, D5). */
  sync?(state: EnginePublicState): void;
}

export class EngineDriver {
  private rafId: number | null = null;
  private lastTs: number | null = null;
  private sink: EngineDriverSink | null = null;

  constructor(private readonly engine: GameEngine) {}

  get running(): boolean {
    return this.rafId !== null;
  }

  /**
   * Attach a sink and start the loop (idempotent: re-attaching replaces
   * the sink). The wall-clock baseline resets so the first frame after an
   * attach contributes zero delta — a remount never fast-forwards.
   */
  attach(sink: EngineDriverSink): void {
    this.sink = sink;
    if (this.rafId === null) {
      this.lastTs = null;
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  /** Stop the loop and drop the sink. Engine state is kept — detach pauses the session, it never resets it. */
  detach(): void {
    this.sink = null;
    this.lastTs = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // One rAF frame: wall delta → advance → project to the sink → reschedule.
  private readonly frame = (ts: number): void => {
    const last = this.lastTs ?? ts;
    this.lastTs = ts;
    this.engine.advance((ts - last) / 1000);
    const sink = this.sink;
    if (sink !== null) {
      sink.frame(this.engine.getRenderState(), this.engine.getRenderTime());
      sink.sync?.(this.engine.getPublicState());
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
}
