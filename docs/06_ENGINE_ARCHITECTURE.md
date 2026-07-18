# ENGINE ARCHITECTURE

Status: Approved design (Sprint 3, Commit 1)
Scope: Game Engine only. This document changes no code.
Goal: The single source of truth for every future Engine refactor and implementation. Every engine extraction commit is a mechanical execution step that consults this document; no engine commit should ever need to make an architectural decision.

Benchmark: production multiplayer crash games (Aviator, JetX class) — a server-authoritative round engine driving thousands of concurrent clients, where the client engine is a deterministic replica that renders correctly from any snapshot, survives reconnects, and is provably unable to influence outcomes.

Companion contract: `docs/05_RENDERING_ARCHITECTURE.md` (binding, fully implemented). The renderer's input (`RenderState`, `RenderTime`) is fixed; this document designs the system that produces it.

---

## 1. Purpose and Design Goals

The Game Engine is the authoritative owner of everything that *happens* in an AQUADIVE round: time, phases, the world, the multiplier, and outcomes. Today all of that lives inside the React component `AbyssAnchor.tsx`, interleaved with `useState`, refs, `setTimeout` chains and the rAF callback. The engine extracts it into a framework-agnostic module with one input edge (commands), two output edges (events + state snapshots), and no knowledge of React, canvas, or money.

Design goals, in priority order:

1. **Determinism.** Given the same starting snapshot, the same command sequence, and the same RNG stream, the engine produces the identical sequence of states. This is the property that makes replays, characterization tests, server reconciliation, and spectator joins possible. Everything else in this document serves it.
2. **Authority-swappable.** The engine must run in two modes with an identical core: *authority mode* (today — the client decides outcomes) and *replica mode* (Phase 8 — outcomes arrive from the server). The mode boundary is a single module (§16), not a rewrite.
3. **Framework independence.** No React, no DOM, no canvas. The engine is a plain TypeScript object that could run in a Web Worker, in Node on the server, or in a test — unchanged.
4. **Fixed contracts on both sides.** The renderer contract (`RenderState`/`RenderTime`) already exists and does not change. The backend contract (§16) is designed now so Phase 8 plugs in without touching the engine core or the renderer.
5. **Auditable money boundary.** The engine computes multipliers and outcomes; it never touches balances. Money math lives outside (§3), exactly as the renderer never knows money exists.
6. **Behavior preservation.** All gameplay formulas, distributions, tunings — including the known jackpot RTP flaw (TASK 001) — move verbatim. The only behavior changes are the five sanctioned deltas in §7.1, ratified by approval of this document.

## 2. Responsibilities of the Game Engine

The engine owns, exclusively:

- **The simulation clock** — fixed ticks, accumulated simulation time (§7, §8).
- **The round state machine** — all phase transitions, including the timed ones that today live in `setTimeout`/`setInterval` (§5).
- **Round lifecycle** — scheduling the betting window, starting dives, ending rounds, intermissions (§6).
- **World simulation** — anchor descent, creature spawning, goldfish collision, golden-boost gain/decay (§9).
- **The multiplier engine** — the growth curve, the boost bonus, the crash check (§9).
- **Outcome application** — crash point, sea-floor jackpot, bonus chests, via the `RoundAuthority` module (§11, §16).
- **Participant round state** — bet placed this round, cashed-out flag and multiplier, chosen chest. (State about the player's *round*, never their wallet.)
- **Entity management** — the creature collection and its lifecycle (§10).
- **Command validation** — accepting or rejecting player commands against the current state (§13).
- **Event emission** — the typed event stream all other systems observe (§12).
- **State projection** — producing `RenderState`/`RenderTime` for the renderer, the public UI state for the HUD, and serializable snapshots (§14, §15).

## 3. Responsibilities That Belong Outside the Engine

| Concern | Owner | Notes |
|---|---|---|
| Wallet / balance / win math | Settlement layer (UI store now, Wallet Service in Phase 8) | Subscribes to engine events; computes `bet × multiplier` and mutates balance. The float-`toFixed(2)` math moves there verbatim; the integer-minor-units migration is a separate roadmapped task at this boundary and never enters the engine. |
| Bet-vs-balance check | Settlement layer / UI | The engine validates a bet against *round state* (phase, already participating); whether the player can afford it is a wallet question answered before the command is submitted. |
| Rendering | `src/rendering` | Pure consumer of `RenderState` per `docs/05`. |
| UI / HUD / banners / history strip | React shell | Derives everything from engine events + public state. The engine emits no user-facing strings — a hard rule that keeps localization (roadmap) entirely outside. |
| Network transport | `src/network` | Protocol messages in/out; no game logic (existing README contract). |
| Asset loading | `src/rendering/assets.ts` | Already law (docs/05 §15). |
| Audio | `src/audio` (Phase 7) | Subscribes to the same event stream as FX. |
| Persistence, analytics, monitoring | Backend phases | Consume the event stream server-side. |
| Provably-fair commitment/verification | Server (Phase 8) + a client verification UI | The engine only *carries* seeds/results (§11). |
| Input handling | DOM → React → engine commands | The engine never reads input devices. |

## 4. Engine Boundaries

Import rules (enforceable in review, grep-level):

- `src/engine` imports only: its own modules, `src/shared`, and — one sanctioned **type-only** import — the renderer contract types (`RenderState`, `RenderCreature`, `RenderTime`) from `src/rendering`, because the engine implements the projection that produces them. No runtime import from `src/rendering` ever.
- No React, no DOM types, no canvas anywhere in `src/engine`. `requestAnimationFrame` and `performance.now()` appear in exactly one file: the driver (§13), which is the engine's edge to the host environment.
- No `Math.random()` anywhere in `src/engine` except the local RNG implementation inside the RNG module (§11).
- No `setTimeout`/`setInterval` anywhere in `src/engine` — all delays are simulation-time durations evaluated on ticks (§8).
- Nothing outside `src/engine` imports engine internals; the facade (§13) is the only public surface, mirroring the `scene-renderer.ts` convention.
- Constants ownership after extraction (resolves the "until the engine extraction relocates them" corrections in docs/05 §6/§18): gameplay tuning and simulation constants (`src/game/config.ts`, most of `src/game/constants.ts`, the pure math in `src/lib/abyss-game.ts`) become engine domain modules; pure presentation constants (`MAX_DPR`, `ANCHOR_SCREEN_Y_FRAC`, `ANCHOR_DRAW_H`, `ANCHOR_RING_Y_FRAC`, `SHIP_IMPACT_FX_SECONDS`, `BG_*`) move under `src/rendering`; world-geometry constants needed by both sides (`CHAIN_MAX_DEPTH`, `ANCHOR_WORLD_OFFSET_PX`, `SHIP_WORLD_Y`) move to the `src/shared` dependency floor. Exact file layout is finalized in the extraction commits; the ownership rule is fixed here.

## 5. Complete Round State Machine

Engine states get honest names; the renderer keeps the existing `Phase` strings via a fixed projection map, so the `RenderState` contract is untouched.

| Engine state | Renderer `Phase` | Meaning |
|---|---|---|
| `betting` | `"idle"` | Betting window open; countdown running; world at surface. |
| `diving` | `"diving"` | Anchor descending; multiplier growing; cashout available. |
| `crashed` | `"crashed"` | Chain snapped; crash banner interval before next round. |
| `impact` | `"cashed"` | Anchor hit the sea floor; jackpot locked; impact FX playing. |
| `bonus` | `"bonus"` | Three chests revealed; waiting for the pick; result interval after. |

Transitions (guard → action → target). All timed transitions are simulation-time durations owned by the state machine; on exit from a state its pending timer is cancelled — this structurally removes today's `setTimeout` race guards (`if (phaseRef.current === ...)`).

```
betting ──[countdown ≤ 0]────────────────────────────▶ diving
          entry(diving): RoundAuthority samples crashAt; world reset;
                          per-round participant flags reset; diveStartedAt := simTime

diving ──[multiplier ≥ crashAt]──────────────────────▶ crashed        (terminal for the tick, §6)
          entry(crashed): clamp multiplier to crashAt; emit crashed;
                          schedule CRASH_BANNER duration → betting

diving ──[worldY ≥ CHAIN_MAX_DEPTH]──────────────────▶ impact         (terminal for the tick, §6)
          entry(impact): RoundAuthority samples jackpot; lock jackpot multiplier;
                          impactAt := simTime; emit shipImpact;
                          schedule SHIP_IMPACT_TO_CHESTS duration → bonus

impact ──[timer]─────────────────────────────────────▶ bonus
          entry(bonus): RoundAuthority rolls chests; emit chestsRevealed

bonus ──[pickChest command] → apply chest ──[CHEST_RESULT duration]──▶ betting

crashed ──[timer]────────────────────────────────────▶ betting
          entry(betting): countdown := BETTING_WINDOW_SECONDS; emit bettingOpened
```

Rules and notes:

- **Manual cashout is not a transition.** It flips the participant's `cashedOut` flag while the state stays `diving` — exactly today's behavior (the anchor keeps descending after cashout).
- **`bonus` has no timeout today** (an unpicked chest waits forever). Preserved as-is in the client version; a server-authoritative round cannot wait on one player, so an *auto-pick timeout* transition is reserved here for Phase 8 (server picks after N seconds). Documented now so it lands as a config value, not a redesign.
- Illegal transitions and commands invalid for the current state are rejected and reported (§12, §18) — never silently applied, never thrown across the tick boundary.
- The `crashed`/`impact` double-fire race that exists today (both conditions can trigger in the same frame because the current tick body has no early exit) is resolved by the terminal-transition rule in §6. Sanctioned delta D3.

## 6. Round Lifecycle

One full round, end to end:

1. **Betting** — countdown from `BETTING_WINDOW_SECONDS`, decremented per tick. `placeBet` commands accepted (one per participant per round). Countdown is *engine state* read by the UI each frame; the UI's 100 ms display interval is deleted (delta D5).
2. **Dive start** — automatic on countdown expiry (rounds run whether or not anyone bet — spectating already exists and stays). `RoundAuthority` fixes `crashAt`; the world resets (worldY = 0, creatures cleared, spawn cursor reset, boost = 0, multiplier = 1).
3. **Per-tick pipeline while `diving`** (fixed order, preserved verbatim from today's tick body):
   1. advance simulation clock
   2. multiplier from dive-elapsed simulation time (`multiplierAt`)
   3. boost decay; boost bonus added to multiplier
   4. crash check (`multiplier ≥ crashAt`) → transition, **end of pipeline for this tick**
   5. descent integration (`descentSpeed(m)` × boost speed factor × dt)
   6. creature spawning (spawn-ahead window, jittered interval)
   7. goldfish collision → boost gain
   8. sea-floor check (`worldY ≥ CHAIN_MAX_DEPTH`) → transition, **end of pipeline for this tick**
   A terminal transition (steps 4, 8) ends the pipeline for that tick. Today the remaining steps still run once after a crash — a measure-zero, invisible difference (next frame's phase check stopped them anyway), removed because it is the source of the §5 double-fire race. Sanctioned delta D3.
4. **Round end, path A: crash** — banner interval, then back to betting. If the participant hadn't cashed out, the settlement layer records the loss (the bet was already debited at `placeBet`).
5. **Round end, path B: jackpot** — jackpot locked and (if participating and not yet cashed) auto-cashed at the jackpot multiplier; impact FX; chests revealed; pick multiplies the jackpot; result interval; back to betting.
6. **Intermission = the next betting window.** There is no separate state; `betting` is both.

Round identity: every round gets a monotonically increasing `roundId`, stamped on all events and snapshots. Today nothing consumes it; multiplayer, history, and provably-fair verification all key on it, so it exists from day one (it costs one integer).

## 7. Fixed Tick Model

- **Tick rate: 60 Hz** (`TICK_SECONDS = 1/60`). Chosen to match the dominant display rate so per-tick integration granularity stays closest to today's per-frame granularity on typical hardware.
- **Accumulator driver.** The driver feeds wall-clock frame deltas into an accumulator; the engine consumes whole ticks: `while (acc ≥ TICK_SECONDS && ticksThisAdvance < MAX_TICKS_PER_ADVANCE) step()`.
- **Catch-up cap preserved.** `MAX_TICKS_PER_ADVANCE = 3` (= 0.05 s), the direct translation of today's `MAX_TICK_SECONDS` clamp. Excess accumulated time is dropped, exactly as the clamp drops it today: after a tab switch the world resumes, it does not fast-forward.
- **Simulation time is tick-derived**: `simTime = tickCount × TICK_SECONDS`. The multiplier, all phase timers, `animTime`, and FX elapsed all read this one clock.
- **Rendering is decoupled.** The driver renders once per rAF with the latest state, at whatever rate the display runs. Ticks and frames are independent; interpolation between ticks is deliberately *not* built now (at 60 Hz ticks the error is ≤ one frame) — reserved for replica mode if server snapshot rates demand it (§17).
- **Determinism statement**: state(n+1) = f(state(n), commandsAppliedAtTickBoundary, rngDraws). No other inputs exist. This is the invariant every engine commit must preserve.

### 7.1 Sanctioned behavior deltas

The only intended behavior changes of the entire engine extraction. Approval of this document ratifies them; each is called out again in the commit that lands it.

| # | Delta | Today | After | Why sanctioned |
|---|---|---|---|---|
| D1 | Multiplier & phase timers move to the simulation clock | Multiplier uses *wall-clock* elapsed while descent uses *clamped* dt — after a tab-away the multiplier (and crash) jump ahead while the world stands still | One clock; multiplier and world can never diverge | The current split is an inconsistency, not a feature; determinism requires one clock |
| D2 | Fixed 60 Hz integration replaces display-rate variable dt | dt = display frame time (≈7 ms at 144 Hz) | dt = 16.6 ms always | Descent is a Riemann sum of a smooth curve; the difference is sub-pixel over a dive, and identical across all devices — an anti-flaw for fairness |
| D3 | Terminal transition ends the tick pipeline | Post-crash steps still run once; crash and floor can double-fire in one frame | Pipeline exits at the transition | Removes a real race; visually unobservable |
| D4 | Commands apply at the next tick boundary | `cashOut` reads the multiplier from the last React render | Cashout uses the tick-authoritative multiplier | ≤ one frame difference; removes a stale-state read (the engine value can only be *more* current) |
| D5 | Countdown/HUD values are per-frame state reads | 100 ms `setInterval` UI updates | UI reads engine state each frame | Cosmetic; smoother, and deletes a timer |

## 8. Time Management

Exactly three clocks exist in the system, each with one owner:

| Clock | Owner | Consumers | Rule |
|---|---|---|---|
| Wall clock (`performance.now`) | Driver only | Feeds the accumulator; measures render `frameDt` | Never visible inside engine logic |
| Simulation clock (`simTime`, tick-derived) | Engine | Multiplier curve, phase timers, countdown, spawn scheduling, boost decay, `animTime`, FX elapsed | The only clock gameplay may read |
| Render time (`RenderTime { animTime, frameDt }`) | Driver assembles from the two above | Renderer | Already law (docs/05 §4) |

Consequences:

- Every `setTimeout`/`setInterval` in the component today (`CRASH_BANNER_MS`, `SHIP_IMPACT_TO_CHESTS_MS`, `CHEST_RESULT_TO_IDLE_MS`, `CASH_FLASH_MS`/`JACKPOT_FLASH_MS`, the countdown interval) is replaced: round-lifecycle delays become state-machine durations on the simulation clock; pure UI flash timings (`CASH_FLASH_MS`, `JACKPOT_FLASH_MS`) stay in the UI shell — they are presentation, not round lifecycle.
- Timer quantization to whole ticks (±16.7 ms vs. today's millisecond timers) is inside human perception threshold and covered by D1.
- **Ship-impact FX elapsed** becomes `simTime − impactAt`, computed by the engine into `RenderState.shipImpact.elapsed`. The `performance.now()` bookkeeping block in the component (the caller-side half of the docs/05 R5 handoff) is deleted; the renderer contract is unchanged.
- `animTime` continues as the accumulated clamped clock — after extraction that is precisely `simTime`, preserving sway/bubble behavior including the "no fast-forward after tab-away" property.

## 9. Simulation Responsibilities

The `diving` pipeline (§6.3) decomposes into five systems. All formulas, tables and constants move **verbatim**; sources named so extraction commits are mechanical:

| System | Owns | Today lives in |
|---|---|---|
| Multiplier | `multiplierAt` curve, boost bonus (`+ boost × BOOST_MULTIPLIER_BONUS`), crash clamp | `abyss-game.ts` + tick body |
| Descent | `descentSpeed(m)` × `(1 + boost × BOOST_SPEED_FACTOR)` × dt integration | `abyss-game.ts` + tick body |
| Spawner | spawn-ahead window (`SPAWN_AHEAD_PX`), jittered interval (`CREATURE_SPAWN_EVERY − rng × SPAWN_JITTER_PX`), depth-banded kind tables, creature attribute rolls | `spawnCreature` + tick body |
| Collision | goldfish pickup (`COLLISION_DY_PX` / `COLLISION_DX_FRAC` against anchor point `worldY + ANCHOR_WORLD_OFFSET_PX`) → boost gain | tick body |
| Boost | gain per goldfish, decay per second, clamp [0, 1] | tick body |

Notes fixed here:

- The engine's anchor position for collision is `worldY + ANCHOR_WORLD_OFFSET_PX` — the *simulation* anchor. The renderer's sway offset is presentation and must never feed back into collision (already law, docs/05 §9). The collision X-window is a fraction of screen width today (`COLLISION_DX_FRAC` vs. creature `x`); it is resolution-independent as written (both sides are 0..1 fractions) and moves as-is.
- The multiplier curve and distributions are *domain* modules (pure functions), separable from the systems that call them — they are what client and server will share in Phase 8. `timeForMultiplier` (currently unused, on the lint baseline) lives there; replica-mode extrapolation (§17) is its intended consumer.
- Physics beyond descent (the roadmap's "Physics" objective) is *this*: descent kinematics, collision, boost. No general physics engine is built — non-goal (§20).

## 10. Entity Management

Deliberate decision, mirroring the renderer's no-scene-graph stance: **a flat, engine-owned creature array — no ECS, no entity framework.**

- Creatures are plain data (`id`, `kind`, `x`, `worldY`, `size`, `phase`, `dir`, `consumed?`), id from a per-engine counter, collection reset at dive start.
- Lifecycle: spawned by the Spawner ahead of the anchor; mutated only by the Collision system (`consumed`); cleared on round reset. Within a round the array grows to a few hundred entries at most (bounded by dive length) — no pruning needed today. The pruning rule from docs/05 §14.4 (drop creatures far above the viewport) is an engine responsibility *when profiling demands it*; recorded, not built.
- Projection: `RenderCreature` (`Pick` of the draw-relevant fields, `readonly`) — the renderer never sees engine-internal fields.
- A second entity kind (e.g., obstacles) = a second flat collection with its own system + projection. If genuinely shared behavior emerges across three-plus kinds, that is the trigger to reconsider — documented so nobody bolts an ECS on casually.

## 11. RNG Boundary

The finding that shapes this section: **every random draw in the engine is outcome-relevant.** Crash point, jackpot, and chests obviously so — but creature spawning too, because goldfish placement → boost → multiplier bonus **and** descent speed → payout and time-to-floor. There is no "cosmetic randomness" in the engine; all cosmetic RNG already lives in the renderer's Effects layer (docs/05 §12) and stays there.

Design:

- One injected `Rng` service (`rng.next(): number` in [0, 1), seedable). Every draw site in the engine calls it; `Math.random` appears only inside the local implementation.
- **Two named streams**, drawn independently: `outcome` (crash point, jackpot, chest values) and `world` (spawn intervals, creature kinds/attributes). Same interface, separate sequences — so a server can disclose the world seed to all clients (identical creatures for every spectator, replayable) while outcome values follow the provably-fair commitment scheme and are disclosed per-event.
- **Authority mode (now):** both streams are `Math.random`-backed. The client-authoritative RNG/economy is a known, accepted flaw (TASK 001) until Phase 8 — the boundary exists so fixing it is a swap, not a refactor.
- **Replica mode (Phase 8):** outcome values arrive as protocol events (the engine never draws them); the world stream is seeded from the server's per-round seed and consumed deterministically by tick order.
- Tests inject a seeded deterministic `Rng` — this plus §7 determinism is what makes characterization and replay tests possible at all.
- Provably-fair commitment (hash of server seed published pre-round, revealed post-round) is server-side Phase 8 design; the engine's only obligation, met by this section, is that outcome consumption is isolated and per-round keyed (`roundId`).

## 12. Engine Events

The event bus is the engine's broadcast edge: typed, synchronous, fire-and-forget. It is how settlement, UI, FX, audio (Phase 7), and analytics (Phase 8+) observe the game without the engine knowing they exist.

Event map (payloads carry `roundId`; shapes finalized in the extraction commit that lands the bus):

| Event | Fired on | Primary consumers |
|---|---|---|
| `bettingOpened` | entry(betting) | UI |
| `betPlaced { amount }` | accepted bet command | Settlement (debit), UI |
| `commandRejected { command, reason }` | any invalid command | UI (dev-visible), monitoring later |
| `diveStarted` | entry(diving) | UI |
| `cashedOut { multiplier }` | accepted cashout | Settlement (credit), UI banner |
| `crashed { multiplier }` | entry(crashed) | Settlement (loss record), UI, history, FX/audio later |
| `shipImpact { jackpotMultiplier }` | entry(impact) | Settlement (jackpot credit), UI, history; FX already ride `RenderState.shipImpact` per docs/05 §17 |
| `chestsRevealed { chests }` | entry(bonus) | UI |
| `chestPicked { chestId, chestMultiplier, finalMultiplier }` | accepted pick | Settlement (delta credit), UI, history |
| `roundEnded { outcome }` | entry(betting) from crashed/bonus | History, analytics later |
| `stateChanged { from, to }` | every transition | UI shell, debugging |
| `engineError { code, detail }` | invariant violation (§18) | UI, monitoring later |
| *(reserved)* `goldfishConsumed`, `boostExpired` | collision/boost systems | future FX/audio triggers — the docs/05 §17 event channel |

Rules:

- **Edge-triggered only.** Nothing fires per tick; continuous values (multiplier, countdown, boost) are *state*, read via `getPublicState()` each frame — the same pull model the renderer uses. This keeps the bus quiet enough to serialize wholesale to a server or an analytics sink later.
- **Dispatch happens after the tick completes**, from a per-tick queue — listeners always observe a consistent post-tick engine state, never a mid-pipeline one.
- **Listeners cannot reenter.** Commands submitted from inside a listener are queued for the next tick like any other command (§13) — no reentrancy by construction.
- **Listener exceptions are firewalled** by the bus: caught, logged, remaining listeners still run (§18). A broken FX hook must never kill settlement.
- Events may start *cosmetic or bookkeeping* behavior only; nothing a listener does can influence the simulation mid-round except by submitting commands.

## 13. Engine Public API

One facade, one driver, mirroring the `SceneRenderer` convention (only the facade is imported from outside `src/engine`):

```ts
// Commands — the input edge. These shapes ARE the future protocol messages.
type EngineCommand =
  | { type: "placeBet"; amount: number }
  | { type: "cashOut" }
  | { type: "pickChest"; chestId: 0 | 1 | 2 };

class GameEngine {
  constructor(deps: { rng: Rng; authority: RoundAuthority; config: EngineConfig });

  advance(wallDtSeconds: number): void;      // driver-only: accumulate → step ticks → dispatch events
  submit(command: EngineCommand): void;      // queued; validated + applied at the next tick boundary

  readonly events: EventBus<EngineEventMap>; // subscribe/unsubscribe

  getRenderState(): RenderState;             // projection, docs/05 §4 shape, byte-compatible
  getRenderTime(): RenderTime;               // { animTime: simTime, frameDt }
  getPublicState(): EnginePublicState;       // phase, countdownSeconds, multiplier, boost,
                                             // participant {betAmount, cashedOut, cashedOutAt} | null,
                                             // chests, chosenChestId, roundId
  snapshot(): EngineSnapshot;                // §14
  restore(snapshot: EngineSnapshot): void;   // §14
}
```

- **The driver** (`EngineDriver`, client-side) owns the rAF loop and the wall clock — the two host-environment dependencies. Per frame: `engine.advance(wallDt)` → `renderer.frame(engine.getRenderState(), engine.getRenderTime())` → sync the UI store from `getPublicState()`. The rAF loop leaves the React component; docs/05 §17 ("the rAF loop belongs to the engine driver") is fulfilled.
- **Engine lifetime is decoupled from React.** The driver+engine pair is owned per game session (module/app scope), not per component mount; a thin hook attaches/detaches the canvas and store. Remounting the component no longer restarts the world — the engine-side twin of the renderer's docs/05 §2.3 fix.
- **Command queue.** Commands are validated against the state *at the tick they apply*, not at submit time. Rejections emit `commandRejected` — commands never throw. This single mechanism gives determinism (commands are part of the replayable input log) and is wire-shaped for Phase 8: in replica mode `submit` forwards to the server and the authoritative accept/reject comes back as an event.
- `EngineConfig` carries the tuning currently in `src/game/config.ts`/`constants.ts` (injected, not imported ambient) — the future server-configurable surface (admin panel, Phase 9) and the white-label hook on the gameplay side.

## 14. Snapshot Model

A snapshot is the complete, serializable, plain-data state of the engine — the unit of restore, reconnect, spectator join, replay, and testing.

Contents (exact fields finalized in the extraction commit; categories fixed here):

- `schemaVersion`, `roundId`, `tickCount` (⇒ `simTime`)
- State-machine position: current state + remaining duration of its pending timer (if any) + countdown remaining
- Round data: dive-start sim time, `crashAt`†, jackpot multiplier (once locked), chest values† (once rolled), `impactAt`
- World: `worldY`, boost, spawn cursor (`nextSpawnAt`, next creature id), creature array
- Participant state: bet amount, cashed-out flag + multiplier, chosen chest
- RNG stream positions (seeded mode) — so restore + replay continues the identical sequence

† **Secrecy classes.** Fields marked † are *authority-secret*: they exist before they are publicly knowable (`crashAt` from dive start, chest values from reveal). Two snapshot views follow: **AuthoritySnapshot** (everything — local mode, server internal) and **PublicSnapshot** (secrets withheld until their disclosure event). The server broadcasts only PublicSnapshots; a client can never be handed the crash point early. In today's authority-mode client the distinction is latent (one process), but the shape is designed now so Phase 8 does not re-cut the snapshot.

Invariants:

- Plain JSON-serializable data — no functions, no class instances, no DOM handles.
- `RenderState` and `EnginePublicState` are pure projections of (snapshot, simTime); given a snapshot, the first rendered frame is correct by construction — this is the reconnect/spectator-join guarantee of docs/05 §17 made concrete.
- Determinism restated on snapshots: `restore(s)` + identical commands + identical RNG ⇒ identical subsequent snapshots. This is the contract the future test harness asserts.

## 15. Renderer ↔ Engine Contract

Already fixed by docs/05; restated as obligations on the engine:

- The engine produces `RenderState` **byte-compatible** with the docs/05 §4 shape: `phase` (via the §5 projection map), `worldY`, `depthRatio` (= `min(1, worldY / CHAIN_MAX_DEPTH)`), `boost`, `creatures` (projected, readonly), `crashed`, `shipImpact { elapsed } | null` (simulation-clock based, §8).
- Two channels in, zero out (docs/05 §17): per-frame state pull + sparse FX events (reserved events in §12); the renderer emits nothing back. The renderer never imports from `src/engine`; the engine's one type-only import from rendering (§4) points the dependency arrow the safe way.
- The driver is the only mediator: the renderer never schedules itself, the engine never draws. `RenderTime.animTime = simTime` preserves all sway/bubble behavior.
- No money, no bets, no multiplier *values* cross this boundary — unchanged law.

## 16. Backend ↔ Engine Contract

Designed now, implemented in Phase 8. The boundary is the `RoundAuthority` module plus the `RoundService` interface already reserved in `src/network`:

- **`RoundAuthority`** is the only place outcome decisions are made: `sampleCrashPoint`, `sampleJackpot`, `rollBonusChests` (moved verbatim from `abyss-game.ts` / the component). The state machine *asks* the authority at the transition points (§5); it never draws RNG itself.
  - `LocalRoundAuthority` (now): draws from the injected outcome RNG stream. This is today's behavior behind tomorrow's seam.
  - `RemoteRoundAuthority` (Phase 8): returns outcomes received from the server via `RoundService`; the client engine becomes a replica that *applies* outcomes instead of deciding them.
- **Engine core is mode-blind.** State machine, simulation systems, projections, snapshots, events — identical in both modes. The mode is chosen by dependency injection at construction (§13). This is the load-bearing claim of the whole design: Phase 8 swaps two injected modules (`Rng` source, `RoundAuthority`) and adds transport; it does not touch the engine core or the renderer.
- **Protocol direction** (shapes finalized in Phase 8's protocol design, the remaining Phase 2 blueprint portion): client→server = `EngineCommand` messages, unchanged shape; server→client = round lifecycle events (schedule, start, crash, impact, chests, settle) + periodic `PublicSnapshot`s for sync/join. The event names in §12 are chosen to correspond 1:1.
- **Settlement moves server-side entirely** in Phase 8; the client settlement listener degrades to applying server wallet events for display. Because money never entered the engine (§3), this migration doesn't touch it.
- Timing sync (server clock offset estimation, snapshot reconciliation, drift correction) is driver-level replica-mode work, reserved — explicitly *not* designed in detail now (§20 non-goals).

## 17. Multiplayer Readiness

What this architecture already provides for Phase 8, by construction:

- **Spectating is native.** Rounds run with zero participants today (`participating = false` path); "other players watching your round" is the same code path.
- **Participants generalize.** Participant round state is keyed data; the local client instantiates one entry. Other players' bets/cashouts arrive as events and render as UI lists — no engine change.
- **Join-in-progress / reconnect** = `restore(PublicSnapshot)` + render; correct first frame guaranteed (§14).
- **Smooth display between server updates**: the multiplier is an analytic function of dive-elapsed time shared by client and server (domain module, §9), so the client extrapolates the displayed curve between authoritative messages instead of interpolating jerky samples — the standard crash-game technique, enabled by keeping the curve pure and shared. (`timeForMultiplier` is its inverse, kept for this purpose.)
- **Server tick independence.** The server may run its authoritative loop at 10–30 Hz and broadcast sparsely; the client replica still ticks at 60 Hz for smooth world motion. Nothing in the engine assumes tick rate equals frame rate (§7).
- **Determinism + command log** = server-side round replay for dispute resolution and anti-cheat auditing (roadmap) with no additional machinery.
- **Web Worker option preserved**: because the engine is DOM-free with a message-shaped API (`submit` in, events/snapshots out), moving it off the main thread later is a transport change, not a refactor. Not planned; noted as a kept-open door.

## 18. Error Handling Philosophy

Three rings, three policies:

1. **Boundaries validate, never throw.** Every command is checked against the current state; invalid ⇒ `commandRejected` event, engine state untouched. Malformed external input (future: network messages) is rejected at the `src/network` edge before the engine sees it.
2. **Interior asserts invariants.** Inside the tick pipeline, impossible states (negative worldY, multiplier below 1, timer on a state that has none) are programming errors: in dev they throw immediately and loudly; in production they emit `engineError`, **freeze the simulation**, and surface the failure. For a real-money game the fail-safe direction is always *stop* — never guess, never fabricate an outcome, never silently continue a corrupted round. (Client-local mode may then recover by discarding the round to `betting`; a server decides its own recovery policy in Phase 8.)
3. **Neighbors are firewalled.** Event-listener exceptions are caught by the bus and logged; remaining listeners run (§12). Renderer exceptions are the driver's problem and never reach the engine. The engine never wraps its own pipeline in a blanket `try/catch` — that would convert loud programming errors into silent corruption, the worst outcome for auditability.

No user-facing strings anywhere in engine errors — codes + structured detail; the UI/localization layer owns wording (§3).

## 19. Future Scalability

- **Second game on the platform** (vision doc): the honest current answer is that the engine is *AQUADIVE's* engine. The generic parts (fixed-tick loop, event bus, state-machine mechanics, snapshot discipline, RNG service) are built cleanly enough to extract into a platform core **when a second game exists** — extracting a "generic engine" now, against one game, would be speculative abstraction (Master Rules: no placeholder code). The boundary lines drawn here (domain modules vs. systems vs. core mechanics) are what make that later split cheap.
- **Feature growth maps onto existing edges**: auto-cashout = a client-side rule that submits `cashOut` when the public multiplier crosses a threshold (no engine change); tournaments/achievements/analytics = event-stream consumers; admin configuration (Phase 9) = `EngineConfig` served remotely; bonus systems = new authority outcomes + states added to the machine in §5's documented style.
- **Performance**: the simulation is trivially cheap (one entity array, closed-form math — well under 1 ms/tick; the docs/05 frame-time meter already brackets the whole tick+render cost). Disciplines that keep it that way: no per-tick allocation in steady state (reuse the creature array, no closures in the pipeline), snapshots built on demand — never per tick, projections reusing scratch objects once profiling justifies it (same "do when" philosophy as docs/05 §14).
- **What deliberately does not scale-proof now**: no Web Worker move, no interpolation buffers, no multi-round pipelining (crash games run one global round at a time — a design fact, not a limitation).

## 20. Risks and Non-Goals

Risks:

1. **Behavioral drift during extraction** — the top risk, as in Sprint 2, but harder: simulation has no screenshot test. Mitigation: characterization tests *before* moving code (§21 step E1) pinning the pure math (curve values, distribution shapes/bounds, tier tables) and, after the state machine lands, transition-sequence tests on a seeded engine. The five sanctioned deltas (§7.1) are the *only* permitted differences; anything else stops the commit (Master Rules: never guess).
2. **React interleaving during migration.** Mid-extraction, state lives briefly in two places (engine + component refs/`useState`). Mitigation: each commit moves one system *completely* (owner changes, mirror deleted in the same commit); the UI store syncs one way (engine → store) from the first driver commit onward; never two writers.
3. **Timer semantics.** The `setTimeout` chains encode subtle guards (phase re-checks) that the state machine replaces structurally. Mitigation: transition table in §5 is exhaustive; the extraction commit maps every deleted timeout to its state-machine duration and its guard to a transition precondition, in the commit message.
4. **Test harness is a new dependency** (vitest is the natural fit for this Vite project). Adding a devDependency needs explicit approval — flagged here so E1 isn't blocked silently.
5. **The deferred `sampleJackpot` micro-task** (move to `src/lib/abyss-game.ts`) is superseded by this design: its destination is now the engine's `RoundAuthority` domain. Recommendation: fold it into the authority-extraction commit instead of executing the stale plan — needs owner sign-off (recorded in CURRENT_TASK).
6. **Scope creep** — the standing risk: "while we're in there" tuning of curves, RTP, or timings. This document is the contract; economics rebalance remains a separate approved task.

Non-goals of the engine work (explicitly out of scope):

- No server implementation, no transport, no wire-format finalization (Phase 8; protocol design is the remaining Phase 2 deliverable and lands with it).
- No RTP/economics rebalance — the jackpot flaw moves verbatim (TASK 001 decision).
- No integer-minor-units money migration (separate task at the settlement boundary; money never enters the engine).
- No interpolation/prediction buffers, no clock-sync design (replica-mode work).
- No ECS, no general physics, no generic multi-game engine (see §10, §19).
- No UI rework — the React shell keeps its current look and behavior; it just stops simulating.

## 21. Recommended Extraction Strategy (high level)

Same discipline as Sprint 2: one step per commit, behavior-preserving (modulo §7.1 deltas, each landing in exactly one identified commit), game playable after every commit, doc corrected first on any conflict. Order chosen so each commit moves code with fewer dependencies than the next, and so determinism tooling exists before the code it must protect:

| Step | Contents | Sanctioned deltas landing |
|------|----------|---------------------------|
| E0 | This document (Sprint 3, Commit 1) | — |
| E1 | Test harness (vitest, needs approval) + characterization tests pinning current pure math and distributions | — |
| E2 | Domain consolidation: pure math/types/tuning → engine domain modules; `RoundAuthority` seam with `LocalRoundAuthority` (absorbs the `sampleJackpot` move, pending sign-off); `Rng` service injection | — |
| E3 | Engine skeleton: facade, simulation clock + fixed-tick accumulator (driven from the existing component rAF), event bus | D2 |
| E4 | Round state machine: all phase transitions + timers move into the engine; component `setTimeout`/`setInterval` chains deleted; settlement listener extracted from the transition code | D1, D3 |
| E5 | Simulation systems move: descent, spawner, collision, boost, multiplier into the tick pipeline; command queue (`placeBet`/`cashOut`/`pickChest`) replaces direct callbacks | D4 |
| E6 | Driver + projections: `EngineDriver` owns rAF; engine produces `RenderState`/`RenderTime`/public state; component becomes a UI shell (canvas mount + HUD + store subscription); snapshot()/restore() landed and exercised by tests | D5 |

Step boundaries may be re-cut when reality demands (Sprint 2 precedent: R5 shrank because R3's fixed contract pulled work forward) — recorded in CURRENT_TASK the moment it happens. Exact file layout inside `src/engine` (facade, driver, state machine, systems, domain, rng, events, snapshot modules per §4's rules) is finalized in E2–E3, not here.

Per-commit validation gate (the engine twin of docs/05 §21): `tsc --noEmit` clean; lint at recorded baseline; all tests green from E1 onward; manual gameplay pass — full loop: bet → dive → cash out → crash round → jackpot round → chest pick → spectate a round (docs/18 step 2, developer); console hygiene; from E3 onward, a seeded-engine determinism spot-check (same seed + commands ⇒ same snapshot).

---

*This document is the single source of architectural truth for the Game Engine. If an extraction commit discovers a conflict between this document and reality, the commit stops and the document is corrected first (Master Rules: never guess).*
