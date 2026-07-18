# CURRENT TASK

**TASK 006 — Sprint 3: Game Engine (Phase 5). ACTIVE.**

Approvals received 2026-07-18: Commit 1 (`docs/06_ENGINE_ARCHITECTURE.md`) approved — **sanctioned behavior deltas D1–D5 (§7.1) are ratified**; **vitest devDependency approved** (E1).

Commit 2 (E1) is COMPLETE: vitest harness (`vitest.config.ts`, `npm test`) + 26 characterization tests pinning the pure math (`src/lib/abyss-game.test.ts`), the outcome distributions including `sampleJackpot` (`src/components/AbyssAnchor.test.ts` — pinned in place via a behavior-neutral `export` before E2 moves it), and every tuning value (`src/game/config.test.ts`, `src/game/constants.test.ts`). Lint baseline is now **33 errors + 7 warnings** (the +1 warning is the temporary `sampleJackpot` export; E2 removes it). Awaiting review/approval before E2.

Next (must not begin until E1 is approved):

- **E2 — Domain consolidation:** pure math/types/tuning → engine domain modules; `RoundAuthority` seam with `LocalRoundAuthority`; `Rng` service injection. Absorbs the `sampleJackpot` move (the superseded micro-task, §20 risk 5 — recommendation recorded, still needs explicit owner sign-off). Characterization tests migrate their imports in the same commit and must stay green; the depth-banded creature kind table gets pinned in the commit that extracts it (it is unreachable by tests while a component closure).
- Then E3–E6 per `docs/06_ENGINE_ARCHITECTURE.md` §21, one commit each, approval between commits.

Standing rules:

- One extraction step per commit; behavior-preserving (modulo the ratified §7.1 deltas, each landing in exactly one identified commit); game playable after every commit.
- Per-commit validation gate (doc 06 §21): `tsc --noEmit` clean; lint at the recorded baseline (33 + 7); **all tests green**; manual gameplay pass; console hygiene; from E3 onward, a seeded-engine determinism spot-check.
- Follow `docs/18_GIT_WORKFLOW.md`: verify → commit → push → wait for approval.
- `docs/05_RENDERING_ARCHITECTURE.md` remains the binding rendering contract (its §18 import rules and §21 validation still apply); `docs/06_ENGINE_ARCHITECTURE.md` is the binding engine contract — on any conflict with reality, the commit stops and the document is corrected first.
