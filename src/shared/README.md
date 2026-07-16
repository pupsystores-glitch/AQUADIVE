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

## Planned contents (per the approved refactoring plan)

Money module (Step 1.3); protocol types ahead of the backend split
(blueprint milestone M2, later extracted to a workspace package in M4).
