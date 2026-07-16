# CURRENT TASK

TASK 004

Foundation Refactor

Objective:

Execute the approved frontend refactoring plan (TASK 003) as small, behavior-preserving commits.

Progress:

- Commit 1 — Step 1.1 (extract gameplay constants into `src/game/config.ts`): DONE, verified.
- Commit 2 — Type system extraction (`src/game/types.ts`): DONE, verified.
- Commit 3 — Static constants extraction (`src/game/constants.ts`): DONE, verified.
- Commit 4 — Architectural folders (`src/engine`, `src/rendering`, `src/network`, `src/audio`, `src/shared` + READMEs): DONE, verified.
- Commit 5 — Shared pure utilities (`src/shared/utils/color.ts`, `lerpColor` moved): DONE, awaiting approval.
- Next (needs approval): remaining half of Step 1.2 — move `sampleJackpot` (gameplay economics) from the view file into `src/lib/abyss-game.ts`.

Rules for this task:

- Preserve gameplay, visuals, rendering and UI exactly.
- One refactoring step per commit.
- The game must remain playable after every commit.
- Wait for approval between steps.
