// Effects layer — ship-impact jackpot FX (Sprint 2, Commit R3;
// docs/05_RENDERING_ARCHITECTURE.md §5 layer 5, §12). Timing contract: the
// layer receives `shipImpact: { elapsed } | null` in RenderState and draws
// while `elapsed < SHIP_IMPACT_FX_SECONDS`; the performance.now()
// bookkeeping lives with the caller — this layer is clock-free. The FX
// position tracks the swaying anchor via the Actor layer's pure helpers
// (§18 correction, R3). Per §12 this layer is exempt from the no-RNG rule
// (jitter inside drawShipImpact).

import { ANCHOR_DRAW_H, SHIP_IMPACT_FX_SECONDS } from "../constants";
import { drawShipImpact } from "../draw/impact-fx";
import type { RenderLayer } from "../render-state";
import { anchorPinY, anchorSwayX } from "./actor";

export const effectsLayer: RenderLayer = {
  name: "effects",
  render(ctx, state, camera, time) {
    // Ship impact burst — pink jackpot lightning for ~1.4s after hit
    if (state.shipImpact === null) return;
    const { elapsed } = state.shipImpact;
    if (elapsed >= SHIP_IMPACT_FX_SECONDS) return;
    const life = Math.min(1, elapsed / SHIP_IMPACT_FX_SECONDS);
    const { w, h } = camera.viewport;
    const anchorX = anchorSwayX(time.animTime, w);
    drawShipImpact(ctx, anchorX, anchorPinY(h) + ANCHOR_DRAW_H * 0.3, w, h, elapsed, life);
  },
};
