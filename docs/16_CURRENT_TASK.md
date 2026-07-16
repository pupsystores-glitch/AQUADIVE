# CURRENT TASK

TASK 005

Sprint 2 — Rendering Architecture

Objective:

Design and then extract the rendering system, per the approved roadmap (Phase 2 deliverable feeding Phase 4).

Progress:

- Commit 1 — Architecture Planning (`docs/05_RENDERING_ARCHITECTURE.md`, documentation only): DONE, verified.
- Commit 2 — R1: eight draw helpers moved verbatim into `src/rendering/draw/` + `theme.ts` color tokens: DONE, awaiting approval.
- Next (needs approval): Commit R2 — `src/rendering/camera.ts`, replacing the inline `worldToScreen` closure and culling checks, per §19.

Notes carried over from Sprint 1 (TASK 004):

- Sprint 1 closed after Commit 5. The remaining half of Step 1.2 (move `sampleJackpot` into `src/lib/abyss-game.ts`) was not executed and remains pending; it must be scheduled as its own commit when approved.

Rules for this task:

- Rendering commits follow `docs/05_RENDERING_ARCHITECTURE.md` §19 (extraction order) and §21 (validation) exactly.
- Behavior-preserving only; no gameplay, visual, or tuning changes.
- One extraction step per commit; the game must remain playable after every commit.
- Wait for approval between commits.
