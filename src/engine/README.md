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
constants. Remaining seams (E5 removes): the diving pipeline body is
injected (`divingTick`, called only while diving; returns a terminal
outcome — D3); `crashAt`/`diveElapsed` exposed for it; pickChest applies
immediately (D4 pending).

Next — E5: simulation systems + command queue (D4). E6: EngineDriver +
projections + snapshots (D5).
