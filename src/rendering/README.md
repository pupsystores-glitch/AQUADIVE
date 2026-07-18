# src/rendering

Canvas 2D rendering system.

Binding design: `docs/05_RENDERING_ARCHITECTURE.md`.

## Responsibility

Turns an engine state snapshot into pixels: the scene renderer, the camera
(world→screen transform), layered draw modules (background, world, actors,
FX), and asset loading (sprites, future atlases).

## Boundaries

- No game rules, no money math, no React components.
- Reads engine state; never mutates it.
- May subscribe to engine events for fire-and-forget FX triggers only.

## Contents (per docs/05_RENDERING_ARCHITECTURE.md §18–19)

Done — R1: `theme.ts` (color tokens) and `draw/` modules (ship, chain,
anchor, creatures, sea floor + treasure, impact FX), moved verbatim.
R2: `camera.ts` (anchor-locked world→screen transform + culling predicate).
R3: `render-state.ts` (RenderState/RenderTime/RenderLayer contract),
`scene-renderer.ts` (public entry point: ctx/DPR/resize, camera ownership,
ordered layer list, `frame()`), and the five `layers/` modules
(background → environment → world → actor → effects; array order is
z-order).
R4: `assets.ts` (AssetManager: manifest + eager preload + ready-gated
handles; the anchor sprite's module-scope `new Image()` is gone —
no asset URLs or Image side effects outside `assets.ts`).
R5: FX timing handoff completed (`draw/impact-fx.ts` holds no timing
knowledge — `dt` and `life` arrive as parameters; the lifetime constant
lives with the Effects layer) + dev-only frame-time meter in
`scene-renderer.ts` (rolling avg + p95, console-logged; the sole
sanctioned wall-clock read under `src/rendering`, dead code in prod).

R1–R5 complete — the rendering architecture of
`docs/05_RENDERING_ARCHITECTURE.md` is fully implemented. The game
component now contains simulation + UI only; Phase 5 (engine extraction)
can proceed against this stable rendering API.

Sprint 3 E2 (docs/06 §4 constants ownership): presentation constants now
live here — `constants.ts` (`MAX_DPR`, `ANCHOR_SCREEN_Y_FRAC`,
`ANCHOR_DRAW_H`, `ANCHOR_RING_Y_FRAC`, `SHIP_IMPACT_FX_SECONDS`) and the
`BG_*` background palette in `theme.ts`. `render-state.ts` now owns the
contract types outright: `Phase` and `RenderCreature` (with `CreatureKind`
from `src/shared/creatures.ts`) are defined here, and the engine's domain
types conform to them — the sanctioned type-only import direction is
engine → rendering (docs/06 §4), never the reverse.
