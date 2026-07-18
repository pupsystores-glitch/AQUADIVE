// Camera — vertical-only, anchor-locked world→screen transform
// (Sprint 2, Commit R2; docs/05_RENDERING_ARCHITECTURE.md §6).
// The transform reproduces the component's former inline closure bit-for-bit:
//   screenY = h * ANCHOR_SCREEN_Y_FRAC + (worldY − (followY + ANCHOR_WORLD_OFFSET_PX))
// X is untransformed by design; the camera stays vertical-only until a
// feature demands otherwise.

import { ANCHOR_WORLD_OFFSET_PX } from "@/shared/world";
import { ANCHOR_SCREEN_Y_FRAC } from "./constants";

export class Camera {
  private followY = 0;

  readonly viewport = { w: 0, h: 0 };

  /** Owner-only: update the viewport size (CSS pixels) before rendering. */
  setViewport(w: number, h: number) {
    this.viewport.w = w;
    this.viewport.h = h;
  }

  /** Owner-only: anchor-locked follow — the world scrolls past the pinned anchor. */
  follow(worldY: number) {
    this.followY = worldY;
  }

  worldToScreenY(worldY: number): number {
    return (
      this.viewport.h * ANCHOR_SCREEN_Y_FRAC + (worldY - (this.followY + ANCHOR_WORLD_OFFSET_PX))
    );
  }

  /**
   * Culling predicate: is a world-Y position within the viewport plus margins?
   * Margins are independent per edge (§6 correction, R2); pass `Infinity` to
   * disable a bound. Comparisons are inclusive.
   */
  isVisibleY(worldY: number, marginTop: number, marginBottom: number = marginTop): boolean {
    const sy = this.worldToScreenY(worldY);
    return sy >= -marginTop && sy <= this.viewport.h + marginBottom;
  }
}
