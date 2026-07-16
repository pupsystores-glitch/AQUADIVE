# src/engine

Framework-agnostic game engine.

## Responsibility

Owns the simulation: the game loop (rAF driver, delta-time handling), the
round state machine (betting → diving → crashed/bonus → idle), world
simulation (creature spawning, collisions, anchor kinematics), and the typed
event bus that other systems subscribe to.

## Boundaries

- No React, no DOM (except `requestAnimationFrame` via the loop driver).
- No canvas drawing — the engine produces state; `src/rendering` consumes it.
- No network calls — round events arrive through the service interface in
  `src/network`.

## Planned contents (per the approved refactoring plan)

Game loop (Step 3.2), world simulation (Step 3.1), round engine (Step 3.3),
event bus (Step 4.1), round state machine (Step 4.2), stores (Step 4.3).
