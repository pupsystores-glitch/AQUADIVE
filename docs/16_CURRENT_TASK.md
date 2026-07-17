# CURRENT TASK

Sprint 2 close-out — awaiting approval. No implementation task is active.

TASK 005 (Sprint 2 — Rendering Architecture) is CLOSED: Commits 1–6 delivered (planning + R1–R5); the rendering architecture of `docs/05_RENDERING_ARCHITECTURE.md` is fully implemented. Phase 4 of the roadmap is complete. Sprint 2 summary and retrospective: `docs/15_PROGRESS.md`.

Next (must not begin until this close-out is approved):

- **Sprint 3 — Phase 5: Game Engine extraction.** Move simulation out of `AbyssAnchor.tsx` into `src/engine` behind the existing `RenderState` contract: state machine, round engine, event bus (FX triggers per `docs/05_RENDERING_ARCHITECTURE.md` §17), multiplier engine, game loop / engine driver. Sprint 3 begins with its own planning commit (architecture doc before code, as Sprint 2 did).
- **Pending micro-task (any time, own commit, needs approval):** move `sampleJackpot` from the game component into `src/lib/abyss-game.ts` (deferred half of Sprint 1 Step 1.2).

Standing rules:

- One extraction step per commit; behavior-preserving; game playable after every commit.
- Follow `docs/18_GIT_WORKFLOW.md`: verify → commit → push → wait for approval.
- `docs/05_RENDERING_ARCHITECTURE.md` remains the binding rendering contract; renderer-affecting changes must respect its §18 import rules and §21 validation.
