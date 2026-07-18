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

## Contents (per docs/06_ENGINE_ARCHITECTURE.md §21)

Done — E2 (domain consolidation): `domain/` pure modules moved verbatim —
`multiplier.ts` (growth curve + inverse), `descent.ts` (descent speed),
`outcomes.ts` (crash/jackpot/chest distributions over an injected Rng),
`creatures.ts` (Creature data + depth-banded spawn tables), `tuning.ts`
(gameplay/simulation constants, the future EngineConfig surface);
`rng.ts` (Rng service, §11 — the only Math.random site in the engine);
`round-authority.ts` (RoundAuthority seam + LocalRoundAuthority, §16);
`index.ts` (the public surface until the E3 facade; outcome distributions
deliberately not exported — outcomes are drawn only through a
RoundAuthority); `test/sequence-rng.ts` (deterministic Rng for tests).

Next — E3: GameEngine facade, simulation clock + fixed-tick accumulator,
event bus. E4: round state machine. E5: simulation systems + command queue.
E6: EngineDriver + projections.
