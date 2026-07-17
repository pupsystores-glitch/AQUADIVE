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

Pending — R4: `assets.ts`; R5: FX timing handoff + frame-time meter.
