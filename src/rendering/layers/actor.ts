// Actor layer — chain + anchor + sway math (Sprint 2, Commit R3;
// docs/05_RENDERING_ARCHITECTURE.md §5 layer 4, §9). The whole sway block
// moved as one unit from the component's drawScene (§20 risk 4): pendulum X,
// sway angle, ring-position trig, chain endpoints — all formulas verbatim,
// derived only from the animation clock and the viewport. Draw order within
// the layer: chain → anchor.
//
// The pendulum X and pinned screen-Y are exported as pure helpers so the
// Effects layer can anchor impact FX to the swaying anchor without
// duplicating the formula (§18 correction, R3).

import { ANCHOR_DRAW_H, ANCHOR_RING_Y_FRAC } from "@/game/config";
import { ANCHOR_SCREEN_Y_FRAC, SHIP_WORLD_Y } from "@/game/constants";
import { assets } from "../assets";
import { drawAnchor } from "../draw/anchor";
import { drawChain } from "../draw/chain";
import type { RenderLayer } from "../render-state";

/** Anchor sway — faster & wider for a more natural pendulum swing. */
export function anchorSwayX(animTime: number, w: number): number {
  return w / 2 + Math.sin(animTime * 1.4) * 38 + Math.sin(animTime * 0.7) * 10;
}

/** World camera: anchor is fixed near 55% of screen. */
export function anchorPinY(h: number): number {
  return h * ANCHOR_SCREEN_Y_FRAC;
}

export const actorLayer: RenderLayer = {
  name: "actor",
  render(ctx, state, camera, time) {
    const { w, h } = camera.viewport;

    const anchorScreenY = anchorPinY(h);
    const anchorX = anchorSwayX(time.animTime, w);
    const swayAngle = Math.sin(time.animTime * 1.8) * 0.22 + Math.sin(time.animTime * 0.9) * 0.05;

    // Position the anchor sprite so its horizontal stock bar sits near anchorScreenY.
    const drawH = ANCHOR_DRAW_H;
    const ringOffsetFromCenter = drawH * (0.5 - ANCHOR_RING_Y_FRAC); // ring above sprite center
    // Ring position accounting for rotation around the sprite center.
    const anchorRingY = anchorScreenY - Math.cos(swayAngle) * ringOffsetFromCenter;
    const anchorRingX = anchorX + Math.sin(swayAngle) * ringOffsetFromCenter;
    const ringR = 9;

    // Chain from the surface down to the anchor's shackle ring
    const shipScreenY = camera.worldToScreenY(SHIP_WORLD_Y);
    const chainStartY = Math.min(shipScreenY + 40, 0);
    drawChain(ctx, w / 2, chainStartY, anchorRingX, anchorRingY - ringR, time.animTime);

    // Anchor sprite (in front of shipwreck so it lands ON the ship)
    drawAnchor(
      ctx,
      anchorX,
      anchorScreenY,
      swayAngle,
      state.crashed,
      state.boost,
      drawH,
      assets.get("anchor"),
    );
  },
};
