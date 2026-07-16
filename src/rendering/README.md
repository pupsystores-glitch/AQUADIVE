# src/rendering

Canvas 2D rendering system.

## Responsibility

Turns an engine state snapshot into pixels: the scene renderer, the camera
(world→screen transform), layered draw modules (background, world, actors,
FX), and asset loading (sprites, future atlases).

## Boundaries

- No game rules, no money math, no React components.
- Reads engine state; never mutates it.
- May subscribe to engine events for fire-and-forget FX triggers only.

## Planned contents (per the approved refactoring plan)

Draw modules — ship, chain, anchor, creatures, sea floor, treasure, impact
FX (Step 2.1); SceneRenderer + camera (Step 2.2); asset module (Step 2.3).
