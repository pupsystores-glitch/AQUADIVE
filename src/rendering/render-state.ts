// Rendering contract types — RenderState / RenderCreature / RenderTime /
// RenderLayer (Sprint 2, Commit R3; docs/05_RENDERING_ARCHITECTURE.md §4).
//
// The renderer is a pure consumer: it receives an immutable-by-convention
// RenderState snapshot plus a RenderTime and produces pixels. It never
// mutates game state, never computes outcomes, never knows money exists.
//
// This module OWNS the contract types (Sprint 3, Commit E2, resolving the
// R1 relocation note): `Phase` and `RenderCreature` are defined here, and
// the engine's domain types conform to them — the one sanctioned type-only
// import direction points engine → rendering (docs/06 §4), never the
// reverse.

import type { CreatureKind } from "@/shared/creatures";
import type { Camera } from "./camera";

/** Renderer phase strings — engine states map onto these via a fixed projection (docs/06 §5). */
export type Phase = "idle" | "diving" | "cashed" | "crashed" | "bonus";

/** The subset of a creature the renderer is allowed to see (§10). */
export interface RenderCreature {
  kind: CreatureKind;
  x: number; // 0..1 horizontal position
  worldY: number; // absolute depth (pixels in world space)
  size: number;
  phase: number; // anim offset
  dir: 1 | -1;
  consumed?: boolean;
}

/** Per-frame scene snapshot — produced by the caller (component now, engine after Phase 5). */
export interface RenderState {
  readonly phase: Phase;
  /** Anchor depth, world px. */
  readonly worldY: number;
  /** 0..1 of CHAIN_MAX_DEPTH. */
  readonly depthRatio: number;
  /** 0..1 golden boost. */
  readonly boost: number;
  readonly creatures: readonly RenderCreature[];
  readonly crashed: boolean;
  /** Seconds since ship impact (renderer-clock based), or null when no FX is active. */
  readonly shipImpact: { readonly elapsed: number } | null;
}

/** The only time the renderer ever sees — no wall clocks inside src/rendering (§4). */
export interface RenderTime {
  /** Accumulated simulation-time seconds (dt-clamped); drives sway, rays, bubbles, wiggle. */
  readonly animTime: number;
  /** This frame's clamped dt in seconds. */
  readonly frameDt: number;
}

/** One z-ordered slice of the scene; order in SceneRenderer's array is z-order (§5). */
export interface RenderLayer {
  readonly name: string;
  render(ctx: CanvasRenderingContext2D, state: RenderState, camera: Camera, time: RenderTime): void;
}
