// SceneRenderer — the renderer's single public entry point (Sprint 2,
// Commit R3; docs/05_RENDERING_ARCHITECTURE.md §4). Owns the 2D context,
// backing-store sizing, DPR clamp, per-frame clear/transform reset, the
// Camera, and the ordered layer list (order in the array IS z-order, §5).
//
// frame(state, time) renders one complete frame and is idempotent for
// identical inputs (modulo the Effects layer's permitted RNG, §12). The
// renderer never schedules itself — the rAF loop stays with the caller
// (§17). resize() is explicit: no hidden reads of `window` in draw paths;
// the caller forwards CSS size + devicePixelRatio each frame, preserving
// the previous per-frame resize check exactly.

import { MAX_DPR } from "@/game/constants";
import { Camera } from "./camera";
import { actorLayer } from "./layers/actor";
import { backgroundLayer } from "./layers/background";
import { effectsLayer } from "./layers/effects";
import { environmentLayer } from "./layers/environment";
import { worldLayer } from "./layers/world";
import type { RenderLayer, RenderState, RenderTime } from "./render-state";

// The component may only import from this module (§18); the contract types
// are re-exported here so callers never reach into src/rendering internals.
export type { RenderCreature, RenderState, RenderTime } from "./render-state";

export class SceneRenderer {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly camera = new Camera();

  // Canonical layer order, bottom → top (§5).
  private readonly layers: readonly RenderLayer[] = [
    backgroundLayer,
    environmentLayer,
    worldLayer,
    actorLayer,
    effectsLayer,
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  /** Explicit viewport update: CSS pixel size + raw devicePixelRatio (clamped to MAX_DPR here). */
  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr, MAX_DPR);
  }

  /** Render one complete frame from a state snapshot + render clock. */
  frame(state: RenderState, time: RenderTime) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const { width: w, height: h, dpr } = this;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Camera is updated once per frame from RenderState.worldY before any
    // layer renders (§6); layers never write to it.
    this.camera.setViewport(w, h);
    this.camera.follow(state.worldY);

    for (const layer of this.layers) {
      layer.render(ctx, state, this.camera, time);
    }
  }

  /** Release the canvas/context references. */
  dispose() {
    this.canvas = null;
    this.ctx = null;
  }
}
