# src/shared

Cross-cutting modules shared by every layer.

## Responsibility

Code that engine, rendering, network, audio and UI may all depend on, and
that depends on none of them: money utilities (centralized rounding now,
integer minor units later), shared protocol-shaped types, and small pure
helpers.

## Boundaries

- Zero imports from other src/ layers — this is the dependency floor.
- No React, no DOM, no side effects at module load.

## Contents

Done — `utils/color.ts` (Sprint 1: `lerpColor`); Sprint 3 E2 (docs/06 §4
constants ownership): `world.ts` (world-geometry constants needed by both
engine and renderer: `CHAIN_MAX_DEPTH`, `ANCHOR_WORLD_OFFSET_PX`,
`SHIP_WORLD_Y`) and `creatures.ts` (the `CreatureKind` union — a
protocol-shaped type used by the engine's spawn tables and the renderer's
draw dispatch).

Planned (per the approved refactoring plan): money module (Step 1.3);
protocol types ahead of the backend split (blueprint milestone M2, later
extracted to a workspace package in M4).
