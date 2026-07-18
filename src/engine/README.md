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

Done — E3 (engine skeleton, sanctioned delta D2): `game-engine.ts` — the
GameEngine facade owning the simulation clock (`simTime = tickCount ×
TICK_SECONDS`, §8) and the fixed 60 Hz tick accumulator with the
3-tick/advance catch-up cap (§7; excess dropped — tab switches resume,
never fast-forward); `events.ts` — the typed EventBus (§12: queued emits,
post-tick dispatch, listener-exception firewall, §12 event map shapes
finalized) and `commands.ts` — the `EngineCommand` protocol shapes (§13).
Emitters and the command queue land with their owners (E4/E5). The
per-tick simulation body is still component-owned, injected via the
temporary `deps.tick` seam (deleted in E5); the component rAF feeds
wall-clock deltas into `advance()` until the EngineDriver lands (E6).

Done — E4 (round state machine, sanctioned deltas D1 + D3):
`state-machine.ts` — the five §5 states (betting/diving/crashed/impact/
bonus), roundId, and every lifecycle timer as whole-tick counts on the
simulation clock (§8; the component's setTimeout/setInterval chains and
their phase re-check guards are gone — one pending timer, owned by the
current state, structurally unable to misfire). Entry actions consult the
RoundAuthority (§16); transitions emit the §12 events (stateChanged,
diveStarted, crashed, shipImpact, chestsRevealed, chestPicked, roundEnded,
bettingOpened, commandRejected). `ENGINE_STATE_TO_PHASE` is the fixed §5
projection to renderer Phase strings. `clock.ts` holds the §7 tick
constants.

Done — E5 (simulation systems + command queue, sanctioned delta D4):
`simulation.ts` — `DiveSimulation` owns the world (worldY, boost,
multiplier, the flat creature array + spawn cursor, §10) and the §6.3
diving pipeline moved verbatim from the component (multiplier → boost →
crash check → descent → spawner → collision → sea-floor check; terminal
outcomes end the tick, D3). The E3/E4 `divingTick` seam is deleted; the
state machine drives the simulation directly and owns the participant
round state (§2: betAmount, cashedOut, cashedOutAt — never the wallet).
`GameEngine.submit()` queues `EngineCommand`s; every queued command is
validated and applied at the next tick boundary (D4), before the machine
steps — `placeBet`/`cashOut`/`pickChest` all flow through it (rejections
emit `commandRejected`, §18 ring 1; cashout uses the tick-authoritative
multiplier). The facade exposes the world reads (worldY, boost,
multiplier, creatures) as plain getters until the E6 projections; the
barrel no longer exports the domain functions — the facade and its edges
are the whole public surface.

Next — E6: EngineDriver owns rAF; RenderState/RenderTime/public-state
projections; snapshot()/restore(); component becomes a UI shell (D5).
