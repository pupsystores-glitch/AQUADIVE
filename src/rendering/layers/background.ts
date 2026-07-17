// Background layer — depth-lerped gradient backdrop (Sprint 2, Commit R3;
// docs/05_RENDERING_ARCHITECTURE.md §5 layer 1, §11). Body moved verbatim
// from the component's drawScene; `depthRatio` now arrives in RenderState.

import { BG_BOTTOM_ABYSS, BG_BOTTOM_SURFACE, BG_TOP_ABYSS, BG_TOP_SURFACE } from "@/game/constants";
import { lerpColor } from "@/shared/utils/color";
import type { RenderLayer } from "../render-state";

export const backgroundLayer: RenderLayer = {
  name: "background",
  render(ctx, state, camera) {
    const { w, h } = camera.viewport;

    // Background gradient — shifts darker with depth
    const top = lerpColor(BG_TOP_SURFACE, BG_TOP_ABYSS, state.depthRatio);
    const bot = lerpColor(BG_BOTTOM_SURFACE, BG_BOTTOM_ABYSS, state.depthRatio);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `rgb(${top.join(",")})`);
    grd.addColorStop(1, `rgb(${bot.join(",")})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  },
};
