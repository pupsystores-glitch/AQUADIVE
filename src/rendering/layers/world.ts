// World layer — creatures, surface ship, sea floor/wreck/treasure
// (Sprint 2, Commit R3; docs/05_RENDERING_ARCHITECTURE.md §5 layer 3, §8,
// §10, §11). Bodies moved verbatim from the component's drawScene; draw
// order within the layer is preserved exactly: creatures → surface ship →
// sea floor (§5 — the floor draws before the Actor layer so the anchor
// visibly lands on top). The ship's formerly-inline world position (−180)
// is now the named constant SHIP_WORLD_Y (§8).

import { CHAIN_MAX_DEPTH } from "@/game/config";
import { ANCHOR_WORLD_OFFSET_PX, SHIP_WORLD_Y } from "@/game/constants";
import { drawCreature } from "../draw/creatures";
import { drawSeaFloor } from "../draw/sea-floor";
import { drawShip } from "../draw/ship";
import type { RenderLayer } from "../render-state";

export const worldLayer: RenderLayer = {
  name: "world",
  render(ctx, state, camera, time) {
    const { w, h } = camera.viewport;

    // Draw creatures (behind anchor)
    for (const c of state.creatures) {
      if (!camera.isVisibleY(c.worldY, 120)) continue;
      const sy = camera.worldToScreenY(c.worldY);
      const sx = c.x * w + Math.sin(time.animTime * 0.6 + c.phase) * 12 * c.dir;
      drawCreature(ctx, c.kind, sx, sy, c.size, time.animTime + c.phase, c.consumed === true);
    }

    // Surface ship (only visible near surface)
    const shipScreenY = camera.worldToScreenY(SHIP_WORLD_Y);
    if (camera.isVisibleY(SHIP_WORLD_Y, 120, 80)) {
      drawShip(ctx, w / 2, shipScreenY, time.animTime);
    }

    // Sea floor + shipwreck — drawn BEFORE the anchor so the anchor visibly lands on top.
    const floorScreenY = camera.worldToScreenY(CHAIN_MAX_DEPTH + ANCHOR_WORLD_OFFSET_PX);
    if (camera.isVisibleY(CHAIN_MAX_DEPTH + ANCHOR_WORLD_OFFSET_PX, Infinity, 100)) {
      drawSeaFloor(ctx, w, h, floorScreenY);
    }
  },
};
