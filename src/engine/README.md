# src/engine

Framework-agnostic game engine. Extraction COMPLETE (Sprint 3, E1–E6):
`AbyssAnchor.tsx` is a UI shell; everything that *happens* in a round
happens here.

## Responsibility

Owns the simulation: the game loop (rAF driver, delta-time handling), the
round state machine (betting → diving → crashed/impact/bonus → betting),
world simulation (creature spawning, collisions, anchor kinematics), the
typed event bus that other systems subscribe to, and the projections the
outside reads (`RenderState`/`RenderTime` for the renderer, public state
for the HUD, snapshots for restore/replay).

## Boundaries

- No React, no DOM (except `requestAnimationFrame`, confined to `driver.ts`
  — the engine's edge to the host environment, docs/06 §4).
- No canvas drawing — the engine produces state; `src/rendering` consumes it.
- No network calls — round events arrive through the service interface in
  `src/network`.
- No money — the settlement layer subscribes to engine events (docs/06 §3).

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

Done — E6 (driver + projections + snapshots, sanctioned delta D5 — the
extraction's final step): `driver.ts` — `EngineDriver` owns the rAF loop
and the wall clock (§13; the single sanctioned `requestAnimationFrame`
site, §4): per frame it feeds the wall delta into `advance()` and hands
the engine's projections to the host-supplied sink (render + per-frame
public-state sync; D5 deleted the component's 100 ms countdown interval).
The driver+engine pair is owned per game session at module scope — detach
pauses, re-attach resumes, remounting the component never restarts the
world. The facade's §13 API is final: `getRenderState()` (byte-compatible
docs/05 §4 shape; `shipImpact.elapsed = simTime − impactAt` on the
simulation clock, §8 — the FX lifetime cutoff stays renderer-owned per
docs/05 R5), `getRenderTime()` (`animTime = simTime`; `frameDt` = the
clamped last wall delta the driver fed in), `getPublicState()` (phase via
the fixed §5 projection, countdown, multiplier, boost, participant,
chests, roundId), and `snapshot()`/`restore()` (§14: plain JSON data,
deep-copied both ways, `schemaVersion`-guarded; restore discards pending
commands and accumulated wall time and emits nothing — projections of the
restored state are correct by construction; RNG stream positions are
absent until seeded streams land in Phase 8). The E5 world-read seam
getters (worldY/boost/multiplier/creatures/countdown) are gone; the §7
clock constants left the barrel — outside consumers read projections.
