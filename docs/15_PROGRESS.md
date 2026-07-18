# PROJECT PROGRESS

This document tracks the evolution of the AQUADIVE project.

Rules:

- Update this document only after completing a task.
- Never mark unfinished work as completed.
- Every completed task must include:
  - Task ID
  - Date
  - Summary
  - Files modified
  - Architectural decisions
  - Risks (if any)

Current Status:

Sprint 3 (Game Engine, TASK 006) ACTIVE — Commits 1 (blueprint), 2 (E1), 3 (E2) and 4 (E3) approved; Commit 5 (E4, round state machine) delivered, awaiting approval before E5

Completed Tasks:

---

## TASK 006 — Sprint 3: Game Engine (In Progress)

### Commit 5 — E4: Round State Machine (Timers on the Simulation Clock)

- Date: 2026-07-18
- Summary: All phase transitions and round-lifecycle timers move into the engine (docs/06 §21 step E4; **sanctioned deltas D1 + D3 land here**). `RoundStateMachine` (`src/engine/state-machine.ts`) owns the five §5 states, `roundId`, the betting countdown and the single pending state timer — every duration a **whole-tick count** on the simulation clock (§8 quantization; deterministic integers, no float drift): betting 5 s = 300 ticks, crash banner 2.4 s = 144, impact→chests 1.4 s = 84, chest result 2.2 s = 132. Entry actions consult the injected `RoundAuthority` (§16: crashAt at entry(diving), jackpot at entry(impact), chests at entry(bonus)) and emit the §12 events; `ENGINE_STATE_TO_PHASE` is the fixed §5 projection to renderer `Phase` strings (RenderState contract untouched). Timeout→duration map (per §20 risk 3): countdown `setInterval`+`beginDive` → betting countdown ticks (its `phase==="idle"` guard → transitions only exist from `betting`); `CRASH_BANNER_MS` setTimeout → crashed timer (its `phase==="crashed"` re-check → structural: one timer, owned by the current state, cleared on every entry); `SHIP_IMPACT_TO_CHESTS_MS` setTimeout → impact timer (its `"cashed"||"diving"` re-check → structural); `CHEST_RESULT_TO_IDLE_MS` setTimeout (unguarded) → bonus result timer; `bonusTriggered` one-shot flag → structural (diving exited). D1: the multiplier's elapsed time base is now `engine.diveElapsed` (simulation clock) — after a tab-away, multiplier and world freeze together instead of diverging; D3: the diving pipeline (still component-owned, injected `divingTick`) returns a terminal outcome ("crashed"/"seaFloor") and ends its tick — the machine applies the transition; crash and sea-floor can never double-fire. Settlement extracted from the transition code into event listeners (§21 E4): crashed → clamp display + loss history; shipImpact → jackpot credit/flash/FX bookkeeping/history; chestPicked → delta credit/history — **money math verbatim**, engine never touches balances (§3); `RunState` dissolved (bet → settlement-side `roundBetRef`). Deliberately NOT landed: command queue/D4 (`cashOut` stays a direct callback; `pickChest` calls the engine directly — pre-D4 immediate apply + synchronous dispatch, documented seam), D5 (the 100 ms countdown interval remains, but display-only: it mirrors `engine.countdown`), settlement logic changes (none).
- Files modified: new — `src/engine/state-machine.ts`, `src/engine/clock.ts` (§7 constants moved out of the facade), `src/engine/state-machine.test.ts`; modified — `src/engine/game-engine.ts` (machine steps per tick; `authority`+`divingTick` deps; state/countdown/diveElapsed/crashAt getters; `pickChest`), `src/engine/index.ts`, `src/engine/game-engine.test.ts` (reworked for the new deps), `src/components/AbyssAnchor.tsx` (deletions above; §12 event listeners; D1/D3 tick body), `src/game/types.ts` (`RunState` removed), `src/engine/README.md`, docs.
- Architectural decisions: machine timers stored as integer tick counts (whole-tick §8 quantization made literal — deterministic and drift-free); the diving pipeline reports outcomes and the machine applies transitions (keeps transition authority in one place while systems finish migrating in E5); `engine.pickChest` dispatches its events synchronously so today's same-click UI feedback is preserved until D4 formally moves command application to the tick boundary; `crashAt` exposed on the facade only as a mid-migration read for the pipeline body (internal from E5).
- Risks: none open. Validation gate: `tsc --noEmit` clean; **50/50 tests green** (5 new transition-sequence tests on a seeded engine per §20 risk 1: exact tick durations, event payload pins, D3 no-refire, bonus-waits-forever, rejection reporting; accumulator tests reworked for the machine); lint improved **29+6 → 10+6** (19 pre-existing prettier errors left with the deleted transition code; zero new findings); production build passes; dev server smoke-tested (HTTP 200). Manual gameplay pass: owner's review step.

### Commit 4 — E3: Engine Skeleton (Clock + Fixed-Tick Accumulator + Event Bus)

- Date: 2026-07-18
- Summary: The engine owns time (docs/06 §21 step E3; **sanctioned delta D2 lands here** — the only behavior delta of this commit). `GameEngine` facade (`src/engine/game-engine.ts`): fixed 60 Hz simulation ticks (`TICK_SECONDS = 1/60`) consumed from a wall-clock accumulator; catch-up capped at `MAX_TICKS_PER_ADVANCE = 3` (= 0.05 s, the direct translation of the old per-frame `MAX_TICK_SECONDS` clamp) with excess dropped — after a tab switch the world resumes, never fast-forwards; simulation clock `simTime = tickCount × TICK_SECONDS` (§8), now the source of `RenderTime.animTime` (per §8 the accumulated clamped clock *is* simTime after extraction; `swayRef` deleted). Typed `EventBus` (`src/engine/events.ts`, §12): emits queue, dispatch after each completed tick from `advance()`, listener exceptions firewalled (caught + logged, remaining listeners run, §18), reentrant emits deferred to the next dispatch; the §12 event-map payload shapes are finalized (all carry `roundId`), with `EngineCommand` protocol shapes in `src/engine/commands.ts` (§13). No emitters fire yet — they land with their owners (state machine E4, systems/commands E5). Mid-migration seam per §20 risk 2: the per-tick simulation body stays component-owned, injected as `deps.tick` and run once per fixed tick with dt = 1/60; the component rAF now only feeds wall deltas into `engine.advance()` and renders once per frame with the latest state (§7: ticks and frames independent; §21 E3: "driven from the existing component rAF" — the EngineDriver proper lands in E6). Deliberately NOT landed, per scope: D1 (multiplier stays wall-clock — its read moved from the rAF timestamp to `performance.now()` inside the tick, same clock, sub-ms), D3 (tick-body structure untouched, no early exit), D4/D5, state machine, command queue, settlement changes.
- Files modified: new — `src/engine/game-engine.ts`, `src/engine/events.ts`, `src/engine/commands.ts`, `src/engine/game-engine.test.ts`, `src/engine/events.test.ts`; modified — `src/engine/index.ts` (facade exports), `src/components/AbyssAnchor.tsx` (tick body → `stepSimulation` injected into `GameEngine`; rAF loop feeds `advance()`; `animTime: engine.simTime`; `swayRef` removed), `src/engine/README.md`, `docs/16_CURRENT_TASK.md`, `docs/15_PROGRESS.md`.
- Architectural decisions: on hitting the catch-up cap the accumulator is cleared entirely (§7 "excess accumulated time is dropped" — most faithful to the old clamp, which had no accumulator at all); event dispatch runs after each completed tick (not once per advance) so listeners observe every consistent post-tick state; `EngineCommand`/`EngineStateName` defined as types now so the §12 event map is finalized with the bus (§12: "shapes finalized in the extraction commit that lands the bus") while their machinery stays in E4/E5; `frameDt` keeps the old per-frame clamp — it is the renderer's contract input (docs/05 §4), not a simulation input.
- Risks: none open. Validation gate: `tsc --noEmit` clean; **45/45 tests green** (10 new: accumulator tick/cap/remainder semantics, determinism spot-check per §21 gate — identical advance sequences ⇒ identical tick traces — and EventBus order/unsubscribe/firewall/reentrancy); lint **unchanged at the 29+6 baseline** (zero new findings); production build passes; dev server smoke-tested (HTTP 200). One transient full-suite vitest worker crash was observed once and did not reproduce (passes repeatedly, also with `--no-file-parallelism`) — environment flake, not code. Manual gameplay pass: owner's review step.

### Commit 3 — E2: Domain Consolidation

- Date: 2026-07-18
- Summary: The engine's domain layer exists (docs/06 §21 step E2), all formulas/tables/constants moved verbatim (§9), all 26 E1 pins migrated with identical golden values, suite now 35 tests green. (1) Pure math → `src/engine/domain/`: `multiplier.ts` (`multiplierAt`, `timeForMultiplier`), `descent.ts` (`descentSpeed`), `outcomes.ts` (`sampleCrashPoint`, `sampleJackpot`, `rollBonusChests` as pure functions over an injected `Rng`, incl. the pinned TASK 001 flaws), `creatures.ts` (`Creature` + `rollCreature` — the depth-banded kind table and attribute rolls extracted from the component's `spawnCreature` closure and now pinned by new characterization tests, six draws in the original order), `tuning.ts` (gameplay/simulation constants — the future `EngineConfig` surface). (2) `Rng` service (`src/engine/rng.ts`, §11): `Math.random` appears in the engine only inside `createMathRandomRng`; `outcome` and `world` streams are separate instances. (3) `RoundAuthority` seam (`src/engine/round-authority.ts`, §16): `LocalRoundAuthority` binds the outcome distributions to the injected outcome stream; the deferred `sampleJackpot` micro-task folded in per §20 risk 5 with owner sign-off. (4) §4 constants ownership resolved: presentation scalars → `src/rendering/constants.ts`, `BG_*` palette → `src/rendering/theme.ts`, world geometry → `src/shared/world.ts`, `CreatureKind` → `src/shared/creatures.ts`; `src/game/` keeps only UI-shell values, `formatMultiplier`/`chainTier` → `src/game/presentation.ts` (no user-facing strings in the engine, §3); `src/lib/abyss-game.ts` dissolved. (5) Contract types: `Phase`/`RenderCreature` now defined in `src/rendering/render-state.ts` (resolving the R1 relocation note); engine domain types conform to them, keeping the type-import direction engine → rendering (§4). Component: outcome draws go through `roundAuthority`, world draws through `worldRng` (module-scope until E3 injects them), `spawnCreature` closure deleted, temporary `sampleJackpot` export deleted. Zero behavior change — no sanctioned delta lands in E2.
- Files modified: new — `src/engine/{rng,round-authority,index}.ts`, `src/engine/domain/{multiplier,descent,outcomes,creatures,tuning}.ts` (+ 6 engine test files incl. `test/sequence-rng.ts`), `src/shared/{world,creatures}.ts` (+ test), `src/rendering/constants.ts` (+ test), `src/game/presentation.ts` (+ test); modified — `AbyssAnchor.tsx`, `render-state.ts`, `scene-renderer.ts`, `camera.ts`, `theme.ts`, 4 layer/draw modules, `src/game/{config,constants,types}.ts` (+ their tests), 3 READMEs; deleted — `src/lib/abyss-game.ts` (+ test), `src/components/AbyssAnchor.test.ts`.
- Architectural decisions: `src/engine/index.ts` is the engine's public surface until the E3 facade, and deliberately does not export the outcome distributions — outcomes are drawn only through a `RoundAuthority`; `CreatureKind` sits on the shared floor (protocol-shaped, needed by both sides) rather than in either layer; the component's spawn-jitter draw uses the `world` stream for draw discipline; UI flash timings stay in the shell per §8.
- Risks: none open. Validation gate: `tsc --noEmit` clean; 35/35 tests green; production build succeeds; dev server serves the game; lint baseline improved 33+7 → **29+6** (moved/dissolved code took 4 pre-existing prettier errors and E1's temporary export warning with it; new files are clean — no new findings). Manual gameplay pass: owner's review step.

### Commit 2 — E1: Test Harness + Characterization Tests

- Date: 2026-07-18
- Summary: vitest 4 added as a devDependency (approved with the Commit 1 sign-off, per §20 risk 4) with a minimal `vitest.config.ts` (node environment, native tsconfig-paths resolution; kept separate from the app's TanStack Start vite config) and an `npm test` script. 26 characterization tests pin the current behavior before any code moves (§20 risk 1): the pure math in `src/lib/abyss-game.ts` — `multiplierAt` curve values, `timeForMultiplier` values + round-trip, `descentSpeed` values + 640 px/s cap, `formatMultiplier` (including its `toFixed` float artifact), `chainTier` band boundaries; the outcome distributions via stubbed `Math.random` draw sequences (exact branch boundaries and band arithmetic — deterministic, no statistical assertions) plus hard-bounds sampling — `sampleCrashPoint` (3% instant-crash branch, clamp [1.01, 200]), `rollBonusChests` (60/32/8 bands, 2-decimal rounding, ids/opened structure), `sampleJackpot` (50/35/15 bands, [50, 500]); and verbatim-move tripwires pinning every value in `src/game/config.ts` and `src/game/constants.ts` (§9: "all formulas, tables and constants move verbatim"). The known economics flaws (TASK 001) are pinned as-is, deliberately. One non-test source change: `sampleJackpot` in `AbyssAnchor.tsx` gained an `export` keyword (behavior-neutral) so it can be pinned in place before E2 moves it to `RoundAuthority` — this adds one `react-refresh/only-export-components` lint warning that E2 removes with the move.
- Files modified: `package.json`/`package-lock.json` (vitest devDependency + `test` script), `vitest.config.ts` (new), `tsconfig.json` (include `vitest.config.ts`), `src/lib/abyss-game.test.ts` (new), `src/components/AbyssAnchor.test.ts` (new), `src/game/config.test.ts` (new), `src/game/constants.test.ts` (new), `src/components/AbyssAnchor.tsx` (export keyword only), docs tracking updates.
- Architectural decisions: characterization pins golden values of today's implementation (a failing pin means behavior drifted — the offending commit stops); randomized functions are pinned deterministically by stubbing the ambient `Math.random` (the RNG injection seam arrives in E2 — tests will migrate to seeded `Rng` injection then); distribution tests assert exact branch mappings and hard clamp bounds only, never frequencies, so the suite cannot flake; the depth-banded creature kind table cannot be pinned in E1 (it is a closure inside the component) — its characterization lands in the commit that extracts it (E2/E5), pinned at the new location in the same commit.
- Verification: 26/26 tests green; `tsc --noEmit` clean; production build clean; dev-server SSR smoke test HTTP 200 with canvas markup; lint 33 errors + 7 warnings vs the 33 + 6 baseline — the single new warning is the documented `sampleJackpot` export (temporary until E2); zero findings in the new test files. New lint baseline recorded: 33 errors + 7 warnings.
- Risks: none to the running game (the only runtime change is an `export` keyword). The harness itself is new infrastructure; its value depends on E2+ keeping the pins green.

### Commit 1 — Engine Architecture Planning (documentation only)

- Date: 2026-07-18
- Summary: `docs/06_ENGINE_ARCHITECTURE.md` created — the complete Game Engine architecture blueprint (21 sections): engine responsibilities and boundaries (money, wallet, UI, rendering, network all outside), complete round state machine (betting/diving/crashed/impact/bonus with the renderer `Phase` projection map), round lifecycle with the authoritative per-tick pipeline order, fixed 60 Hz tick model with accumulator and preserved catch-up cap, three-clock time management (wall clock confined to the driver), simulation system decomposition (multiplier/descent/spawner/collision/boost, all formulas verbatim), flat entity management (no ECS), RNG boundary (injected `Rng`, outcome vs. world streams; finding recorded: every engine draw is outcome-relevant because goldfish boost affects payout), edge-triggered typed event map, `GameEngine` facade + `EngineDriver` public API with tick-boundary command queue, snapshot model with authority/public secrecy classes, renderer contract obligations (RenderState byte-compatible), backend contract via the `RoundAuthority` seam (local now, remote in Phase 8 — engine core mode-blind), multiplayer readiness, three-ring error handling (validate/assert/firewall; fail-safe = stop), scalability stance, risks/non-goals, and the E0–E6 extraction order with a per-commit validation gate. No code modified.
- Files modified: `docs/06_ENGINE_ARCHITECTURE.md` (new), `docs/14_TASKS.md`, `docs/15_PROGRESS.md`, `docs/16_CURRENT_TASK.md` (tracking updates).
- Architectural decisions: deterministic fixed-tick simulation on a single engine-owned clock; authority-swappable outcome module (`RoundAuthority`) + injected RNG as the entire Phase 8 seam; commands as queued typed objects that are also the future protocol messages; money kept out of the engine entirely (settlement listener at the event edge); engine lifetime decoupled from React; five sanctioned behavior deltas (D1–D5, §7.1) enumerated as the only permitted differences — ratified by approving the document; `sampleJackpot` micro-task recorded as superseded (destination is now `RoundAuthority`, pending owner sign-off).
- Risks: none to the running game (docs only). Open approval items: vitest devDependency for E1; D1–D5 ratification; `sampleJackpot` fold-in.

---

## TASK 005 — Sprint 2: Rendering Architecture (Completed 2026-07-18)

### Sprint 2 Close-Out Summary

Six commits over 2026-07-17 → 2026-07-18, each approved individually:

1. Commit 1 — `docs/05_RENDERING_ARCHITECTURE.md` blueprint (21 sections, the binding contract).
2. R1 — eight draw helpers → `draw/*.ts` + `theme.ts` color tokens (verbatim, literal-identical).
3. R2 — `camera.ts` (anchor-locked transform + unified culling predicate).
4. R3 — `render-state.ts` + `scene-renderer.ts` + five layers; `drawScene` deleted; component builds `RenderState` from refs.
5. R4 — `assets.ts` AssetManager; module-scope sprite side effect removed.
6. R5 — FX timing handoff completed; dev-only frame-time meter.

Result: `src/rendering` matches §18's target structure exactly; `AbyssAnchor.tsx` (1,415 lines pre-Sprint-2) now holds simulation + UI only and calls one API: `SceneRenderer.frame(RenderState, RenderTime)`. Rendering is a pure `(state, time) → pixels` consumer — no money, no clocks (one sanctioned dev-meter exemption), no RNG below the Effects layer. Phase 4 of the roadmap is complete.

### Sprint 2 Retrospective

**Accomplished:** the entire §19 extraction plan (R1–R5) with zero behavior change across six commits — every commit typechecked, built, stayed at or below the lint baseline (47→33 errors over the sprint), and kept the game playable. The renderer is engine-ready (multiplayer snapshot rendering by construction) and PixiJS-portable at the documented boundary. Four spec-vs-reality gaps were resolved through the doc's own correction rule (§6 culling margins, §18 import allowances ×2, §4/§14/§20 meter clock exemption) — the document stayed authoritative the whole way.

**Lessons learned:** (1) A fixed contract pulls work forward: §4's `RenderState` shape forced the FX-elapsed handoff into R3, shrinking R5 — extraction steps aren't perfectly separable, and recording the scope shift immediately (CURRENT_TASK note) kept later commits honest. (2) "Doc corrected first, in the same commit" scales well: cheap for import-allowance gaps, decisive for the real conflict (meter vs. no-clock rule). (3) Verbatim-move discipline plus a tracked lint baseline is an effective regression tripwire in a project with no test harness. (4) Validation that can't be automated yet (§21 screenshots, gameplay pass) must stay explicitly assigned to the developer per commit, or it silently becomes nobody's job.

**Technical debt intentionally deferred (all recorded in the docs cited):** `sampleJackpot` still in the component (Sprint 1 Step 1.2, own commit); jackpot RTP economics flaw preserved on purpose (TASK 001, rebalance is a separate approved task); creature `switch` → registry (§10, later commit); §7 depth-band palette generalization not implemented (gradient kept verbatim); §14 "do when" optimizations untriggered (gradient caching, wreck pre-render, quality flag); `useSceneRenderer` hook (§17) not built — component owns renderer lifecycle inline until the engine driver exists; FX events ride `RenderState` until the Phase 5 event bus (§17); camera/layers import geometry constants from `src/game` until the engine extraction relocates them (§18 corrections); lint baseline debt (33 prettier errors + 6 warnings, incl. the unused `timeForMultiplier` import); no test harness (golden-image tests unlocked by the layer/state split, planned Phase 5+).

**Sprint 3 readiness:** READY. The engine extraction has a stable output target (`RenderState`), a defined event channel (§17), and a component whose remaining code is exactly the extraction subject (simulation + UI). Risks to plan around: simulation is still interleaved with React state/timers (`setTimeout` phase transitions, `useState`/ref mirrors); money math is float-based (integer minor-units migration is roadmapped); no characterization tests exist — recommend Sprint 3 start with the planning commit plus characterization tests pinning current behavior (including the known economics bug) before moving code.

### Commit 6 — R5: FX timing handoff + frame-time meter

- Date: 2026-07-18
- Summary: The final extraction step (§19 R5). (1) FX timing handoff completed: `draw/impact-fx.ts` no longer imports `SHIP_IMPACT_FX_SECONDS` — the `life = min(1, dt / SHIP_IMPACT_FX_SECONDS)` line moved to the Effects layer (which owns the lifetime per §12's timing contract) and `drawShipImpact` takes `life` as a parameter alongside `dt` (`dt` is still needed raw for bolt rotation). Identical math, identical values; the draw module now holds zero timing knowledge. The `performance.now()` bookkeeping had already moved to the caller in R3 (forced by the fixed §4 contract), as recorded then. (2) Dev-only frame-time meter added to `scene-renderer.ts` (§14 item 8): 120-frame rolling window (fixed `Float64Array` ring — zero steady-state allocation), avg + p95 logged via `console.debug` every 300 frames (~5 s), gated by `import.meta.env.DEV`. Verified compiled out of the production bundle (both call sites eliminated; `import.meta.env` occurs 0 times in output).
- Files modified: `src/rendering/draw/impact-fx.ts`, `src/rendering/layers/effects.ts`, `src/rendering/scene-renderer.ts`, `docs/05_RENDERING_ARCHITECTURE.md` (§4/§14/§20 corrections), `src/rendering/README.md`, tracking docs.
- Architectural decisions: conflict discovered and resolved per the doc's own rule — §14.8/§17 place the frame-time meter inside SceneRenderer, but the §4 hard rule and §20 grep rule banned `performance.now()` under `src/rendering/`, and §14.8's "debug layer" option would break §13's no-canvas-text law. Correction recorded (mirroring §12's RNG exemption): the dev-only meter in `scene-renderer.ts` is the single sanctioned wall-clock read — instrumentation only, never feeds a render path, dead code in production. Meter output is log-only; no public stats getter was added (nothing would consume it yet — no dead API).
- Verification: `tsc --noEmit` clean; production build clean; prod bundle inspected — `frame()` ends at the layer loop, meter calls eliminated; grep rule holds (only the two sanctioned meter lines under `src/rendering/`); lint exactly at the 33 errors + 6 warnings baseline; dev-server SSR smoke test HTTP 200 with canvas markup. §21.5's frame-time number: this commit *introduces* the meter, so it establishes the baseline — the dev-machine reading lands with the developer's manual pass and applies from the next rendering commit onward.
- Risks: none new — parameter-passing refactor with identical arithmetic; meter is dev-only and render-inert. Manual gameplay pass by the developer still required (docs/18_GIT_WORKFLOW.md step 2). With R5, `AbyssAnchor.tsx` contains simulation + UI only and Phase 5 (engine extraction) can proceed against the stable rendering API.

### Commit 5 — R4: AssetManager

- Date: 2026-07-18
- Summary: `src/rendering/assets.ts` created per §15: `AssetHandle { image, ready }`, `AssetManager` with `preload(manifest) → Promise<void>` and `get(key)` (key typed to the manifest, so unknown keys are compile errors), a one-entry V1 manifest (`anchor` → `src/assets/anchor.png`), and eager preload at module init — matching the previous module-scope load, so first-frame behavior is unchanged. `handle.ready` is a getter reproducing the pre-R4 blit predicate exactly (`image.complete && image.naturalWidth > 0`), which also covers the failure policy: a failed load logs once (onerror) and leaves `ready = false` forever; no retries; game keeps running on vector art. The module-scope `ANCHOR_IMAGE` and the `anchor.png` import were deleted from `draw/anchor.ts`; `drawAnchor` now takes an `AssetHandle` as its final parameter (type-only import) and blits only when ready; the Actor layer passes `assets.get("anchor")`. SSR-safe: on the server the handle's image is null and `ready` stays false (previous `typeof window` guard semantics preserved).
- Files modified: `src/rendering/assets.ts` (new), `src/rendering/draw/anchor.ts` (sprite side effect removed; handle parameter), `src/rendering/layers/actor.ts` (import + call site), `src/rendering/README.md`, tracking docs.
- Architectural decisions: none new — §15 implemented as specified; no §18 corrections needed (draw modules and layers were already permitted to import `assets.ts`). `ready` as a live getter (rather than an onload-set flag) was chosen precisely to keep the blit-start frame byte-identical to the old per-frame `complete` poll.
- Verification: `tsc --noEmit` clean; production build clean with the anchor sprite emitted (`anchor-*.png` in `.output/public/assets`); dev-server SSR smoke test HTTP 200 with canvas markup (exercises the module-init SSR path); lint exactly at the 33 errors + 6 warnings baseline — zero findings in rendering files.
- Risks: first-frame behavior was the flagged §20 risk — mitigated by eager module-init preload plus the getter-based ready predicate; load-start timing is unchanged (assets.ts initializes on the same import chain that previously initialized draw/anchor.ts). Manual gameplay pass by the developer still required (docs/18_GIT_WORKFLOW.md step 2).

### Commit 4 — R3: RenderState + SceneRenderer + layers

- Date: 2026-07-18
- Summary: The main extraction step (§19 R3). `src/rendering/render-state.ts` defines the renderer's input contract (`RenderState` with the §4-fixed shape, `RenderCreature` as the §10 `Pick`, `RenderTime { animTime; frameDt }`, and the `RenderLayer` interface). `src/rendering/scene-renderer.ts` is the single public entry point: owns the 2D context, per-frame backing-store/DPR clamp/transform reset (moved verbatim from `drawScene`), the `Camera` (updated once per frame from `RenderState.worldY` before layers render, per §6 — ownership transferred from the component's ref), and the ordered layer list. The `drawScene` body redistributed verbatim into five layers — `layers/background.ts` (depth gradient), `environment.ts` (light rays incl. the `screen` composite save/restore, bubbles), `world.ts` (creatures → surface ship → sea floor, with culling), `actor.ts` (sway math moved as one unit per §20 risk 4; chain → anchor), `effects.ts` (ship-impact FX, clock-free) — statement order preserved exactly. The component's `drawScene` useCallback (with its `[bet]` stale-closure hazard) is deleted; the tick assembles `RenderState` from refs only and calls `resize()` + `frame()`. The ship's inline world position (−180) became `SHIP_WORLD_Y` in `src/game/constants.ts` (§8).
- Files modified: `src/rendering/render-state.ts`, `src/rendering/scene-renderer.ts`, `src/rendering/layers/{background,environment,world,actor,effects}.ts` (new), `src/components/AbyssAnchor.tsx` (drawScene deleted; state assembly in tick), `src/game/constants.ts` (SHIP_WORLD_Y), `docs/05_RENDERING_ARCHITECTURE.md` (§18 corrections), `src/rendering/README.md`, tracking docs.
- Architectural decisions: §18 corrected per the doc's own rule — layers import the geometry constants their moved code already referenced (until the engine extraction); `effects.ts` imports the pure `anchorSwayX`/`anchorPinY` helpers from `layers/actor.ts` (impact FX track the swaying anchor; Master-Rules no-duplication); `render-state.ts` hosts `RenderLayer`; `scene-renderer.ts` re-exports the contract types so the component imports only from it. Ship-impact FX already ride `shipImpact.elapsed` in state (forced by the fixed §4 contract + the renderer no-clock rule); the `performance.now()` bookkeeping stayed in the component, so R5 shrinks to the `SHIP_IMPACT_FX_SECONDS` draw-module import removal + frame-time meter (recorded in CURRENT_TASK.md). §7's depth-band generalization was deliberately NOT implemented — R3 is move-only; bands are a later approved change.
- Verification: `tsc --noEmit` clean; production build clean; dev-server SSR smoke test HTTP 200 with canvas markup; lint 33 errors + 6 warnings vs 38+7 baseline — zero new findings (5 removed errors sat on deleted `drawScene` lines; 3 prettier findings in new files were caught and fixed pre-commit; the now-unused `eslint-disable react-hooks/exhaustive-deps` directive was removed, −1 warning). Draw order verified by statement-order mapping old `drawScene` → layer sequence (§5 canonical order).
- Risks: camera update now happens before the Background/Environment layers instead of after the bubbles — no observable difference (neither layer queries the camera transform; viewport values are identical). `shipScreenY` is computed twice (World, Actor) from the same pure transform — identical result by construction. Manual gameplay pass + §21 screenshot checkpoints by the developer still required.

### Commit 3 — R2: Camera extracted

- Date: 2026-07-18
- Summary: `src/rendering/camera.ts` created (per §6/§19): vertical-only, anchor-locked `Camera` class with `follow`, `setViewport`, `worldToScreenY`, `isVisibleY`, `viewport`. The component's inline `worldToScreen` closure is deleted; the transform formula moved with its exact floating-point expression order preserved (`h * ANCHOR_SCREEN_Y_FRAC + (worldY − (followY + ANCHOR_WORLD_OFFSET_PX))`). The three ad-hoc culling checks (creatures, ship, sea floor) now go through `camera.isVisibleY`.
- Files modified: `src/rendering/camera.ts` (new), `src/components/AbyssAnchor.tsx` (camera ref + 3 call sites), `docs/05_RENDERING_ARCHITECTURE.md` (§6 correction), `src/rendering/README.md`, tracking docs.
- Architectural decisions: §6 corrected per the doc's own conflict rule — the three real culling checks have different margins (creatures ±120 inclusive; ship −120/+80 exclusive; floor bottom-only +100 exclusive), so `isVisibleY` takes independent `marginTop`/`marginBottom` (default symmetric; `Infinity` disables the top bound) with inclusive comparisons. `setViewport` added as owner-side API. Component owns the `Camera` instance (lazy-init ref) until R3's SceneRenderer takes ownership.
- Verification: `tsc --noEmit` clean; production build clean; full lint back at baseline (38 errors + 7 warnings, zero new findings — one new prettier finding in camera.ts was caught and formatted before commit).
- Risks: at exact floating-point boundary equality the ship/floor culls became inclusive where they were exclusive — a measure-zero, visually unobservable unification recorded in §6. Manual gameplay pass by the developer still required (docs/18_GIT_WORKFLOW.md step 2).

### Commit 2 — R1: Pure draw modules extracted

- Date: 2026-07-17
- Summary: The eight canvas draw helpers (`drawShip`, `drawChain`, `drawShipImpact`, `drawAnchor`, `drawCreature`, `drawFish`, `drawSeaFloor`, `drawTreasure`) moved verbatim from the game component into `src/rendering/draw/` (six modules per §18); static color literals became named tokens in `src/rendering/theme.ts` with byte-identical values (alpha-modulated FX colors exposed as functions taking the per-frame alpha; the alpha math stays at call sites). The preloaded anchor sprite moved with `drawAnchor` (AssetManager replaces it in R4). Component now imports the draw functions; `sampleJackpot` (non-rendering, pending Step 1.2 move) and the SVG icon components stayed put. AbyssAnchor.tsx: 1,415 → 683 lines.
- Files modified: `src/rendering/theme.ts`, `src/rendering/draw/{ship,chain,anchor,creatures,sea-floor,impact-fx}.ts` (new), `src/components/AbyssAnchor.tsx` (deletions + 6 imports only), `src/rendering/README.md`, `docs/05_RENDERING_ARCHITECTURE.md` (§18 import-allowance correction recorded during extraction).
- Architectural decisions: §18 corrected per the doc's own rule — draw modules may additionally use type-only imports from `src/lib/abyss-game` and `SHIP_IMPACT_FX_SECONDS` from `src/game/constants` until R5.
- Verification: scripted verbatim check — ordered sequence of all 658 numeric literals identical old→new; string-literal multiset and template-literal colors identical. `tsc --noEmit` clean; production build clean; dev server SSR-renders the game page without errors. Lint improved 49→38 errors (7 warnings unchanged): 11 pre-existing prettier errors sat on moved lines and the new modules are prettier-clean; zero new findings (3 findings inside the untouched `pickChest` block changed message granularity only — git diff confirms no content change there).
- Risks: client-side visual identity still requires the developer's manual gameplay pass (per docs/18_GIT_WORKFLOW.md step 2).

### Commit 1 — Architecture Planning (documentation only)

- Date: 2026-07-17
- Summary: `docs/05_RENDERING_ARCHITECTURE.md` created — the complete rendering architecture blueprint (21 sections): current-pipeline audit, layered SceneRenderer design (Background / Environment / World / Actor / Effects), Camera class, RenderState contract, per-entity renderer specs, DOM-vs-canvas UI boundary, performance strategy with explicit "do when" triggers, AssetManager design, PixiJS migration stance (Canvas 2D retained; no graphics-API abstraction layer), communication model (state pull + FX events, renderer emits nothing), target folder structure, 5-commit extraction order (R1–R5), risks, and per-commit validation protocol. No code modified.
- Files modified: `docs/05_RENDERING_ARCHITECTURE.md` (new), `docs/14_TASKS.md`, `docs/15_PROGRESS.md`, `docs/16_CURRENT_TASK.md` (tracking updates).
- Architectural decisions: fixed ordered layer list instead of a hierarchical scene graph; renderer as pure `(RenderState, time) → pixels` consumer with a no-clock/no-RNG rule (Effects layer exempted for RNG); vertical-only anchor-locked camera reproducing the current transform bit-for-bit; theme.ts as the white-label color boundary; deliberate refusal to abstract the drawing API before a PixiJS migration.
- Risks: none to the running game (docs only). Sprint 1's deferred `sampleJackpot` move remains pending and is recorded in CURRENT_TASK.md.

---

## TASK 001 — Project Audit

- Date: 2026-07-16
- Summary: Full technical audit of the prototype. Key findings: client-authoritative RNG/economy, jackpot economics far above intended RTP (~1 in 6 rounds reaches the sea floor), 1,400-line game component mixing simulation/rendering/UI, float-based money math, no tests.
- Files modified: none (read-only task).
- Architectural decisions: none (analysis only).
- Risks: jackpot RTP flaw documented; must be preserved during refactor and rebalanced in a separate approved task.

---

## TASK 002 — Architecture Review

- Date: 2026-07-16
- Summary: Complete Architecture Blueprint delivered (Phase 2 deliverable): monorepo layout, framework-agnostic client engine, layered Canvas 2D renderer, event bus, store bridge, protocol-first server boundary with provably-fair RNG, and an 8-milestone strangler-fig migration strategy.
- Files modified: none (design only; blueprint delivered in chat, not yet persisted to /docs).
- Architectural decisions: server-authoritative design; engine outside React; Canvas 2D retained; shared protocol package; money as integer minor units (future step).
- Risks: AQUADIVE_BIBLE.md exists but is empty — content may be missing.

---

## TASK 003 — Project Refactoring Plan

- Date: 2026-07-16
- Summary: Approved 15-step frontend-only refactoring plan (Stages 0–5), each step behavior-preserving and individually revertible; game must remain playable after every step.
- Files modified: none (plan delivered in chat).
- Architectural decisions: verbatim moves over rewrites; characterization tests pin current behavior including known economics bug.
- Risks: two approved corrective micro-deltas deferred to Steps 3.3 and 4.2.

---

## TASK 004 — Foundation Improvements (Sprint 1 — Closed 2026-07-17; Step 1.2 second half deferred)

### Commit 5 — Shared pure utilities

- Date: 2026-07-16
- Summary: `src/shared/utils/` created; `lerpColor` moved verbatim into `src/shared/utils/color.ts` and exported. Scope audit found it is the ONLY function in AbyssAnchor.tsx meeting all purity criteria (no React, no Canvas, no component state, deterministic) — all others are hooks/component methods, canvas draw functions, React icons, or `sampleJackpot` (nondeterministic gameplay economics, excluded twice over). No padding utilities were invented (dead code is forbidden).
- Files modified: `src/shared/utils/color.ts` (new), `src/components/AbyssAnchor.tsx` (imports `lerpColor`).
- Architectural decisions: pure color math sits on the shared dependency floor, usable by rendering and future systems alike.
- Risks: none; tsc clean, lint at baseline.

### Commit 4 — Architectural folder structure

- Date: 2026-07-16
- Summary: Long-term frontend structure prepared: `src/engine`, `src/rendering`, `src/network`, `src/audio`, `src/shared` created, each with a README defining its responsibility, boundaries, and which approved plan steps will populate it. No code moved, no implementations, zero runtime change (documentation files only).
- Files modified: five new `README.md` files (one per folder).
- Architectural decisions: no empty `index.ts` barrels — the project convention (src/lib, src/game) uses direct module imports, and empty barrels would be placeholder code, which the Master Rules forbid; barrels can be added when a folder first exports something. `src/shared` declared the dependency floor (imports from no other layer).
- Risks: none.

### Commit 3 — Static constants extraction

- Date: 2026-07-16
- Summary: Remaining static constants centralized into `src/game/constants.ts` (21 values): player defaults, game-loop/physics limits, golden-boost tuning, countdown tick, rendering/camera constants, ship-impact FX lifetime, and the four background-gradient RGB colors. Byte-identical values; deliberately deduplicated three shared magic numbers (`220` world offset ×3 sites, `1.4`s FX lifetime ×2 sites, bet default ×2 sites). Colors/literals inside standalone draw helpers intentionally deferred to the rendering extraction step; JSX labels deferred to the UI/i18n step.
- Files modified: `src/game/constants.ts` (new), `src/components/AbyssAnchor.tsx` (19 literal sites now reference named constants).
- Architectural decisions: taxonomy split — `config.ts` = gameplay tuning (economics, timings, bets); `constants.ts` = presentation/physics/default constants.
- Risks: none; tsc clean, lint at baseline (47 pre-existing prettier errors + 1 pre-existing hook warning).

### Commit 2 — Type system extraction

- Date: 2026-07-16
- Summary: TypeScript type definitions extracted from the game component into `src/game/types.ts`: `RunState` (moved verbatim) plus `HistoryEntry` and `LastWin` (named versions of previously-inline anonymous `useState` object types). Type-level change only; zero runtime impact.
- Files modified: `src/game/types.ts` (new), `src/components/AbyssAnchor.tsx` (imports the types instead of declaring them).
- Architectural decisions: component-level types live in `src/game/types.ts`; core domain types (`Phase`, `Creature`, `CreatureKind`, `BonusChest`) intentionally remain in `src/lib/abyss-game.ts` until the module reorganization step — no duplicate type sources.
- Risks: none; `tsc --noEmit` clean, lint at baseline. Note: the Write tool silently lost the new file once (suspected antivirus); it was recreated via shell and verified on disk.

### Commit 1 — Step 1.1: Gameplay constants extracted

- Date: 2026-07-16
- Summary: All gameplay tuning constants centralized into a dedicated configuration module. Pure extraction; values byte-identical; no behavior, visual, or rendering change.
- Files modified: `src/game/config.ts` (new), `src/components/AbyssAnchor.tsx` (imports constants instead of hardcoding them).
- Architectural decisions: `src/game/` established as the home of framework-agnostic game modules per the blueprint.
- Risks: none identified; typecheck clean; lint unchanged from baseline (47 pre-existing prettier errors + 1 pre-existing hook warning, both untouched by design).