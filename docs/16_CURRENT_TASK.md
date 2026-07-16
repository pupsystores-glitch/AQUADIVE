# CURRENT TASK

TASK 004

Foundation Refactor

Objective:

Execute the approved frontend refactoring plan (TASK 003) as small, behavior-preserving commits.

Progress:

- Commit 1 — Step 1.1 (extract gameplay constants into `src/game/config.ts`): DONE, verified.
- Commit 2 — Type system extraction (`src/game/types.ts`): DONE, awaiting approval.
- Next (needs approval): Step 1.2 — move stray game math (`sampleJackpot`, `lerpColor`) out of the view file.

Rules for this task:

- Preserve gameplay, visuals, rendering and UI exactly.
- One refactoring step per commit.
- The game must remain playable after every commit.
- Wait for approval between steps.
