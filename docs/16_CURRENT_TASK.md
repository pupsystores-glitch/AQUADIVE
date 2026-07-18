# CURRENT TASK

**TASK 006 — Sprint 3: Game Engine (Phase 5). ACTIVE.**

Approvals received 2026-07-18: Commit 1 (`docs/06_ENGINE_ARCHITECTURE.md`) approved — **sanctioned behavior deltas D1–D5 (§7.1) are ratified**; **vitest devDependency approved** (E1).

Commit 2 (E1) is COMPLETE and approved (2026-07-18): vitest harness + 26 characterization tests.

Commit 3 (E2 — Domain consolidation) is COMPLETE (2026-07-18), awaiting review/approval before E3:

- Pure domain math moved verbatim into `src/engine/domain/` (`multiplier.ts`, `descent.ts`, `outcomes.ts`, `creatures.ts`, `tuning.ts`); `Rng` service (`src/engine/rng.ts`, §11) injected at every engine draw site; `RoundAuthority` seam with `LocalRoundAuthority` (`src/engine/round-authority.ts`, §16). The deferred `sampleJackpot` micro-task was folded into `domain/outcomes.ts` per §20 risk 5 (**owner sign-off received with the E2 approval**). `src/engine/index.ts` is the public surface until the E3 facade; the outcome distributions are deliberately not exported from it.
- §4 constants ownership resolved: gameplay/simulation tuning → `src/engine/domain/tuning.ts`; presentation constants → `src/rendering/constants.ts` (+ `BG_*` palette → `theme.ts`); world geometry (`CHAIN_MAX_DEPTH`, `ANCHOR_WORLD_OFFSET_PX`, `SHIP_WORLD_Y`) → `src/shared/world.ts`. `src/game/` keeps only UI-shell values (`QUICK_BETS`, `HISTORY_LIMIT`, flash timings, player defaults, `COUNTDOWN_TICK_MS`); `formatMultiplier`/`chainTier` → `src/game/presentation.ts` (user-facing strings stay outside the engine, §3). `src/lib/abyss-game.ts` is dissolved. Contract types: `Phase` + `RenderCreature` are now defined in `src/rendering/render-state.ts`; `CreatureKind` sits on the shared floor.
- The depth-banded creature kind table + attribute rolls moved to `rollCreature` (`src/engine/domain/creatures.ts`) and are now pinned (`creatures.test.ts`), as recorded here in E1. All 26 E1 pins migrated with identical golden values; suite is now **35 tests, all green**.
- Lint baseline is now **29 errors + 6 warnings** (E1's temporary `sampleJackpot` export warning removed with the move; 3 kind-table prettier errors left the component with the extracted code — new engine files are prettier-clean; the dissolved `abyss-game.ts` took 1 error with it). All remaining findings are pre-existing.

Next (must not begin until E2 is approved): E3–E6 per `docs/06_ENGINE_ARCHITECTURE.md` §21, one commit each, approval between commits.

Standing rules:

- One extraction step per commit; behavior-preserving (modulo the ratified §7.1 deltas, each landing in exactly one identified commit); game playable after every commit.
- Per-commit validation gate (doc 06 §21): `tsc --noEmit` clean; lint at the recorded baseline (29 + 6); **all tests green**; manual gameplay pass; console hygiene; from E3 onward, a seeded-engine determinism spot-check.
- Follow `docs/18_GIT_WORKFLOW.md`: verify → commit → push → wait for approval.
- `docs/05_RENDERING_ARCHITECTURE.md` remains the binding rendering contract (its §18 import rules and §21 validation still apply); `docs/06_ENGINE_ARCHITECTURE.md` is the binding engine contract — on any conflict with reality, the commit stops and the document is corrected first.
