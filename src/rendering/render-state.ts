// Rendering contract types — RenderState / RenderCreature / RenderTime /
// RenderLayer (Sprint 2, Commit R3; docs/05_RENDERING_ARCHITECTURE.md §4).
//
// The renderer is a pure consumer: it receives an immutable-by-convention
// RenderState snapshot plus a RenderTime and produces pixels. It never
// mutates game state, never computes outcomes, never knows money exists.
//
// Domain types (`Phase`, `Creature`) are type-only imports from
// src/lib/abyss-game until the engine extraction relocates them
// (§18 correction convention, as recorded during R1).

import type { Creature, Phase } from "@/lib/abyss-game";
import type { Camera } from "./camera";

/** The subset of a creature the renderer is allowed to see (§10). */
export type RenderCreature = Pick<
  Creature,
  "kind" | "x" | "worldY" | "size" | "phase" | "dir" | "consumed"
>;

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
