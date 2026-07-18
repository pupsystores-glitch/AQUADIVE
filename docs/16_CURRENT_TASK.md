# CURRENT TASK

**TASK 006 — Sprint 3: Game Engine (Phase 5). ACTIVE.**

Commit 1 (E0, planning) is COMPLETE: `docs/06_ENGINE_ARCHITECTURE.md` created — the complete Game Engine architecture blueprint (21 sections) and the single source of truth for every engine refactor. Documentation only; no code changed. Awaiting review/approval before any further Sprint 3 work.

Next (must not begin until Commit 1 is approved):

- **E1 — Test harness + characterization tests.** Requires explicit approval to add vitest as a devDependency (flagged in `docs/06_ENGINE_ARCHITECTURE.md` §20 risk 4). Tests pin the current pure math and distributions before any code moves.
- Then E2–E6 per `docs/06_ENGINE_ARCHITECTURE.md` §21, one commit each, approval between commits.

Decisions needing owner sign-off (recorded in doc 06):

- **Sanctioned behavior deltas D1–D5** (§7.1): the only intended behavior changes of the extraction (single simulation clock, fixed 60 Hz ticks, terminal-transition tick exit, tick-boundary commands, per-frame countdown reads). Approval of doc 06 ratifies them.
- **`sampleJackpot` deferred micro-task superseded** (§20 risk 5): its planned destination (`src/lib/abyss-game.ts`) is now the engine's `RoundAuthority` domain; recommendation is to fold the move into commit E2 instead of executing the stale plan.
- **vitest devDependency** (E1).

Standing rules:

- One extraction step per commit; behavior-preserving (modulo the ratified §7.1 deltas, each landing in exactly one identified commit); game playable after every commit.
- Follow `docs/18_GIT_WORKFLOW.md`: verify → commit → push → wait for approval.
- `docs/05_RENDERING_ARCHITECTURE.md` remains the binding rendering contract (its §18 import rules and §21 validation still apply); `docs/06_ENGINE_ARCHITECTURE.md` is now the binding engine contract — on any conflict with reality, the commit stops and the document is corrected first.
