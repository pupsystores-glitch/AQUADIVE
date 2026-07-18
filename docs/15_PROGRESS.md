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

Sprint 3 (Game Engine, TASK 006) ACTIVE — Commit 1 (engine architecture blueprint) delivered, awaiting approval before E1

Completed Tasks:

---

## TASK 006 — Sprint 3: Game Engine (In Progress)

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