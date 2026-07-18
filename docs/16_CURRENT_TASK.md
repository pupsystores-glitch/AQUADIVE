# CURRENT TASK

**TASK 006 — Sprint 3: Game Engine (Phase 5). ACTIVE.**

Approvals received 2026-07-18: Commit 1 (`docs/06_ENGINE_ARCHITECTURE.md`) approved — **sanctioned behavior deltas D1–D5 (§7.1) are ratified**; **vitest devDependency approved** (E1).

Commit 2 (E1) is COMPLETE and approved (2026-07-18): vitest harness + 26 characterization tests.

Commit 4 (E3 — Engine skeleton) is COMPLETE (2026-07-18), awaiting review/approval before E4:

- `GameEngine` facade (`src/engine/game-engine.ts`): simulation clock (`simTime`, tick-derived, §8) + fixed 60 Hz tick accumulator with `MAX_TICKS_PER_ADVANCE = 3` catch-up cap, excess dropped (§7). **Sanctioned delta D2 lands here** — fixed-step integration replaces display-rate variable dt; `RenderTime.animTime` now reads `engine.simTime` (§8: the accumulated clamped clock is precisely simTime). The multiplier stays on the wall clock (D1 is E4's delta); the tick-body structure is unchanged (D3 is E4's); no state machine, no command queue, no settlement change.
- Typed `EventBus` (`src/engine/events.ts`, §12): queued emits, post-tick dispatch from `advance()`, listener-exception firewall, reentrant emits deferred to the next dispatch. The §12 event map shapes are finalized (payloads carry `roundId`); `EngineCommand` protocol shapes defined (`src/engine/commands.ts`, §13). Emitters land with their owners in E4/E5.
- Mid-migration seam (§20 risk 2): the per-tick simulation body stays in the component, injected as `deps.tick`, run once per fixed tick; the component rAF feeds wall deltas into `advance()` and renders per frame ("driven from the existing component rAF", §21 E3 — the EngineDriver proper is E6). `swayRef` deleted. The multiplier's wall-clock read moved from the rAF timestamp to `performance.now()` inside the tick (same clock, sub-ms difference).
- Suite now **45 tests green** (10 new: accumulator semantics incl. the E3-scope determinism spot-check — identical advance sequences ⇒ identical tick traces — and EventBus rules). Lint unchanged at the 29+6 baseline; tsc clean; production build passes.

Previous — Commit 3 (E2 — Domain consolidation), COMPLETE and approved (2026-07-18):

- Pure domain math moved verbatim into `src/engine/domain/` (`multiplier.ts`, `descent.ts`, `outcomes.ts`, `creatures.ts`, `tuning.ts`); `Rng` service (`src/engine/rng.ts`, §11) injected at every engine draw site; `RoundAuthority` seam with `LocalRoundAuthority` (`src/engine/round-authority.ts`, §16). The deferred `sampleJackpot` micro-task was folded into `domain/outcomes.ts` per §20 risk 5 (**owner sign-off received with the E2 approval**). `src/engine/index.ts` is the public surface until the E3 facade; the outcome distributions are deliberately not exported from it.
- §4 constants ownership resolved: gameplay/simulation tuning → `src/engine/domain/tuning.ts`; presentation constants → `src/rendering/constants.ts` (+ `BG_*` palette → `theme.ts`); world geometry (`CHAIN_MAX_DEPTH`, `ANCHOR_WORLD_OFFSET_PX`, `SHIP_WORLD_Y`) → `src/shared/world.ts`. `src/game/` keeps only UI-shell values (`QUICK_BETS`, `HISTORY_LIMIT`, flash timings, player defaults, `COUNTDOWN_TICK_MS`); `formatMultiplier`/`chainTier` → `src/game/presentation.ts` (user-facing strings stay outside the engine, §3). `src/lib/abyss-game.ts` is dissolved. Contract types: `Phase` + `RenderCreature` are now defined in `src/rendering/render-state.ts`; `CreatureKind` sits on the shared floor.
- The depth-banded creature kind table + attribute rolls moved to `rollCreature` (`src/engine/domain/creatures.ts`) and are now pinned (`creatures.test.ts`), as recorded here in E1. All 26 E1 pins migrated with identical golden values; suite is now **35 tests, all green**.
- Lint baseline is now **29 errors + 6 warnings** (E1's temporary `sampleJackpot` export warning removed with the move; 3 kind-table prettier errors left the component with the extracted code — new engine files are prettier-clean; the dissolved `abyss-game.ts` took 1 error with it). All remaining findings are pre-existing.

Next (must not begin until E3 is approved): E4–E6 per `docs/06_ENGINE_ARCHITECTURE.md` §21, one commit each, approval between commits.

Standing rules:

- One extraction step per commit; behavior-preserving (modulo the ratified §7.1 deltas, each landing in exactly one identified commit); game playable after every commit.
- Per-commit validation gate (doc 06 §21): `tsc --noEmit` clean; lint at the recorded baseline (29 + 6); **all tests green**; manual gameplay pass; console hygiene; from E3 onward, a seeded-engine determinism spot-check.
- Follow `docs/18_GIT_WORKFLOW.md`: verify → commit → push → wait for approval.
- `docs/05_RENDERING_ARCHITECTURE.md` remains the binding rendering contract (its §18 import rules and §21 validation still apply); `docs/06_ENGINE_ARCHITECTURE.md` is the binding engine contract — on any conflict with reality, the commit stops and the document is corrected first.
